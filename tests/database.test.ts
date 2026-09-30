import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('database enforces privacy, ownership, valid splits, and email-bound invitations', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, email text, email_confirmed_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated;
      grant execute on function auth.uid() to authenticated;
      insert into auth.users values
        ('00000000-0000-0000-0000-000000000001','owner@test.local', now()),
        ('00000000-0000-0000-0000-000000000002','member@test.local', now()),
        ('00000000-0000-0000-0000-000000000003','outsider@test.local', now()),
        ('00000000-0000-0000-0000-000000000004','unverified@test.local', null);
    `);
    await db.exec(await readFile('supabase/migrations/001_initial.sql', 'utf8'));
    const owner = '00000000-0000-0000-0000-000000000001';
    const member = '00000000-0000-0000-0000-000000000002';
    const outsider = '00000000-0000-0000-0000-000000000003';
    const unverified = '00000000-0000-0000-0000-000000000004';
    async function as(id: string) {
      await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub = '${id}';`);
    }
    await as(owner);
    const household = (
      await db.query<{ id: string }>(
        "select public.create_household('Our family','Owner','INR') as id",
      )
    ).rows[0].id;
    await assert.rejects(
      db.query("select public.create_household('Another family','Owner','INR')"),
      /already belong/,
    );
    const token = (
      await db.query<{ token: string }>(
        'insert into public.invitations(household_id,email) values ($1,$2) returning token',
        [household, 'member@test.local'],
      )
    ).rows[0].token;
    await as(outsider);
    assert.equal((await db.query('select * from public.households')).rows.length, 0);
    await assert.rejects(
      db.query('select public.accept_invitation($1,$2)', [token, 'Intruder']),
      /verified email/,
    );
    await as(member);
    await db.query('select public.accept_invitation($1,$2)', [token, 'Member']);
    await assert.rejects(
      db.query('select public.accept_invitation($1,$2)', [token, 'Member']),
      /already used/,
    );
    assert.equal(
      (await db.query('select * from public.household_members($1)', [household])).rows.length,
      2,
    );
    await assert.rejects(
      db.query('insert into public.budgets(household_id,category,amount) values ($1,$2,$3)', [
        household,
        'Groceries',
        1000,
      ]),
      /row-level security/,
    );
    assert.equal(
      (
        await db.query('update public.households set name=$1 where id=$2 returning id', [
          'Hijack',
          household,
        ])
      ).rows.length,
      0,
    );
    await as(owner);
    const privateExpense = (
      await db.query<{ id: string }>(
        "insert into public.expenses(household_id,title,amount,category,visibility,splits) values ($1,'Personal',100,'Other','private',$2) returning id",
        [household, JSON.stringify({ [owner]: 100 })],
      )
    ).rows[0].id;
    const sharedExpense = (
      await db.query<{ id: string }>(
        "insert into public.expenses(household_id,title,amount,category,visibility,splits) values ($1,'Shared groceries',100,'Groceries','shared',$2) returning id",
        [household, JSON.stringify({ [owner]: 60, [member]: 40 })],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        "insert into public.expenses(household_id,title,amount,category,visibility,splits) values ($1,'Bad split',100,'Other','shared',$2)",
        [household, JSON.stringify({ [owner]: 99 })],
      ),
      /must equal/,
    );
    await assert.rejects(
      db.query(
        "insert into public.expenses(household_id,title,amount,category,visibility,splits) values ($1,'Private leak',100,'Other','private',$2)",
        [household, JSON.stringify({ [member]: 100 })],
      ),
      /cannot be shared/,
    );
    await assert.rejects(
      db.query(
        "insert into public.expenses(household_id,title,amount,category,visibility,splits) values ($1,'Foreign split',100,'Other','shared',$2)",
        [household, JSON.stringify({ [outsider]: 100 })],
      ),
      /does not belong/,
    );
    await assert.rejects(
      db.query(
        "insert into public.expenses(household_id,title,amount,category,visibility,splits) values ($1,'Fraction split',100,'Other','shared',$2)",
        [household, JSON.stringify({ [owner]: 33.333, [member]: 66.667 })],
      ),
      /Invalid split/,
    );
    const expired = (
      await db.query<{ token: string }>(
        "insert into public.invitations(household_id,email,expires_at) values ($1,'outsider@test.local',now()-interval '1 day') returning token",
        [household],
      )
    ).rows[0].token;
    const unverifiedToken = (
      await db.query<{ token: string }>(
        "insert into public.invitations(household_id,email) values ($1,'unverified@test.local') returning token",
        [household],
      )
    ).rows[0].token;
    await as(member);
    const visible = (await db.query<{ id: string }>('select id from public.expenses')).rows;
    assert.deepEqual(
      visible.map((e) => e.id),
      [sharedExpense],
    );
    assert.equal(
      (await db.query('select * from public.expenses where id=$1', [privateExpense])).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query("update public.expenses set title='Changed' where id=$1 returning id", [
          sharedExpense,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (await db.query('delete from public.expenses where id=$1 returning id', [sharedExpense])).rows
        .length,
      0,
    );
    await assert.rejects(
      db.query(
        'insert into public.memberships(household_id,user_id,name,role) values ($1,$2,$3,$4)',
        [household, outsider, 'Fake owner', 'owner'],
      ),
      /permission denied/,
    );
    await as(outsider);
    assert.equal((await db.query('select * from public.expenses')).rows.length, 0);
    assert.equal(
      (await db.query('select * from public.household_members($1)', [household])).rows.length,
      0,
    );
    await assert.rejects(
      db.query('select public.accept_invitation($1,$2)', [expired, 'Outsider']),
      /expired/,
    );
    await as(unverified);
    await assert.rejects(
      db.query('select public.accept_invitation($1,$2)', [unverifiedToken, 'Unverified']),
      /verified email/,
    );
    await as(owner);
    assert.equal((await db.query('select * from public.expenses')).rows.length, 2);
    await db.exec('reset role; set role anon;');
    await assert.rejects(db.query('select * from public.expenses'), /permission denied/);
    await assert.rejects(
      db.query('select public.household_members($1)', [household]),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
