-- Run once in the Supabase SQL editor for a new project.
begin;
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 80),
  currency text not null default 'INR' check (currency in ('INR','USD','GBP','EUR','AED','CAD','AUD')),
  monthly_income numeric(14,2) not null default 0 check (monthly_income >= 0),
  created_at timestamptz not null default now()
);
create table public.memberships (
  household_id uuid not null references public.households on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  name text not null check (length(name) between 1 and 80),
  role text not null default 'member' check (role in ('owner','member')),
  primary key (household_id, user_id),
  unique(user_id)
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  owner_id uuid not null default auth.uid() references auth.users,
  title text not null check (length(trim(title)) between 1 and 120),
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  category text not null check (category in ('Groceries','Home & utilities','Transport','Health & insurance','Food & dining','Shopping','Family & kids','Entertainment','Other')),
  date date not null default current_date,
  visibility text not null default 'shared' check (visibility in ('shared','private')),
  splits jsonb not null,
  recurring boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  category text not null check (category in ('Groceries','Home & utilities','Transport','Health & insurance','Food & dining','Shopping','Family & kids','Entertainment','Other')),
  amount numeric(14,2) not null check (amount > 0 and amount <= 100000000),
  unique(household_id, category)
);
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  name text not null check (length(name) between 1 and 80),
  emoji text not null default '🌱' check (length(emoji) <= 12),
  target numeric(14,2) not null check (target > 0 and target <= 100000000),
  saved numeric(14,2) not null default 0 check (saved >= 0 and saved <= 100000000)
);
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households on delete cascade,
  email text not null check (length(email) <= 254 and position('@' in email) > 1),
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz
);
create index expenses_household_date on public.expenses(household_id, date);
create index invitations_household on public.invitations(household_id);

create function public.is_member(hid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where household_id = hid and user_id = auth.uid());
$$;
create function public.is_owner(hid uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.memberships where household_id = hid and user_id = auth.uid() and role = 'owner');
$$;
alter table public.households enable row level security;
alter table public.memberships enable row level security;
alter table public.expenses enable row level security;
alter table public.budgets enable row level security;
alter table public.goals enable row level security;
alter table public.invitations enable row level security;

create policy household_read on public.households for select to authenticated using (public.is_member(id));
create policy household_update on public.households for update to authenticated using (public.is_owner(id)) with check (public.is_owner(id));
create policy membership_read on public.memberships for select to authenticated using (public.is_member(household_id));
create policy expense_read on public.expenses for select to authenticated using (public.is_member(household_id) and (visibility = 'shared' or owner_id = auth.uid()));
create policy expense_insert on public.expenses for insert to authenticated with check (public.is_member(household_id) and owner_id = auth.uid());
create policy expense_update on public.expenses for update to authenticated using (public.is_member(household_id) and owner_id = auth.uid()) with check (public.is_member(household_id) and owner_id = auth.uid());
create policy expense_delete on public.expenses for delete to authenticated using (public.is_member(household_id) and owner_id = auth.uid());
create policy budget_read on public.budgets for select to authenticated using (public.is_member(household_id));
create policy budget_write on public.budgets for all to authenticated using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy goal_read on public.goals for select to authenticated using (public.is_member(household_id));
create policy goal_write on public.goals for all to authenticated using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy invitation_read on public.invitations for select to authenticated using (public.is_owner(household_id));
create policy invitation_insert on public.invitations for insert to authenticated with check (public.is_owner(household_id) and accepted_at is null and expires_at <= now() + interval '7 days');

create function public.check_expense_splits() returns trigger language plpgsql security definer set search_path = '' as $$
declare total numeric := 0; item record;
begin
  if TG_OP = 'UPDATE' and (new.household_id <> old.household_id or new.owner_id <> old.owner_id) then
    raise exception 'Expense ownership cannot be changed';
  end if;
  if jsonb_typeof(new.splits) <> 'object' or new.splits = '{}'::jsonb then raise exception 'Choose people for the split'; end if;
  for item in select * from jsonb_each(new.splits) loop
    if jsonb_typeof(item.value) <> 'number' then raise exception 'Invalid split amount'; end if;
    if (item.value::text)::numeric < 0 or (item.value::text)::numeric <> round((item.value::text)::numeric, 2) then raise exception 'Invalid split amount'; end if;
    if not exists(select 1 from public.memberships where household_id = new.household_id and user_id::text = item.key) then raise exception 'Split member does not belong to this household'; end if;
    if new.visibility = 'private' and item.key <> new.owner_id::text then raise exception 'Private expenses cannot be shared'; end if;
    total := total + (item.value::text)::numeric;
  end loop;
  if total <> new.amount then raise exception 'Split amounts must equal the total'; end if;
  return new;
end;
$$;
create trigger validate_splits before insert or update on public.expenses for each row execute function public.check_expense_splits();

create function public.create_household(household_name text, display_name text, chosen_currency text default 'INR') returns uuid language plpgsql security definer set search_path = '' as $$
declare hid uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  if exists(select 1 from public.memberships where user_id = auth.uid()) then raise exception 'You already belong to a household'; end if;
  insert into public.households(name, currency) values (trim(household_name), chosen_currency) returning id into hid;
  insert into public.memberships(household_id, user_id, name, role) values (hid, auth.uid(), trim(display_name), 'owner');
  return hid;
end;
$$;
create function public.household_members(target_household uuid) returns table(id uuid, name text, email text, role text) language sql stable security definer set search_path = '' as $$
  select m.user_id, m.name, u.email::text, m.role from public.memberships m join auth.users u on u.id = m.user_id
  where m.household_id = target_household and public.is_member(target_household);
$$;
create function public.accept_invitation(invite_token uuid, display_name text) returns uuid language plpgsql security definer set search_path = '' as $$
declare invite public.invitations; verified_email text;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select email into verified_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  select * into invite from public.invitations where token = invite_token and accepted_at is null and expires_at > now() for update;
  if invite.id is null then raise exception 'This invitation has expired or was already used'; end if;
  if verified_email is null or lower(invite.email) <> lower(verified_email) then raise exception 'Sign in with the verified email address this invitation was sent to'; end if;
  if exists(select 1 from public.memberships where user_id = auth.uid()) then raise exception 'You already belong to a household'; end if;
  insert into public.memberships(household_id, user_id, name, role) values (invite.household_id, auth.uid(), trim(display_name), 'member');
  update public.invitations set accepted_at = now() where id = invite.id;
  return invite.household_id;
end;
$$;

-- Explicit grants keep service credentials out of the browser.
revoke all on public.households, public.memberships, public.expenses, public.budgets, public.goals, public.invitations from anon, authenticated;
grant select, update on public.households to authenticated;
grant select on public.memberships to authenticated;
grant select, insert, update, delete on public.expenses, public.budgets, public.goals to authenticated;
grant select, insert on public.invitations to authenticated;
revoke execute on function public.is_member(uuid), public.is_owner(uuid), public.check_expense_splits(), public.create_household(text,text,text), public.household_members(uuid), public.accept_invitation(uuid,text) from public, anon;
grant execute on function public.is_member(uuid), public.is_owner(uuid), public.create_household(text,text,text), public.household_members(uuid), public.accept_invitation(uuid,text) to authenticated;
commit;
