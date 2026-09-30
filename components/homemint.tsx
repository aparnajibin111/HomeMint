'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Download,
  Heart,
  House,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBasket,
  SlidersHorizontal,
  Sparkles,
  Sprout,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
  Car,
  Utensils,
  ShoppingBag,
  Baby,
  Clapperboard,
  Pencil,
  Copy,
  type LucideIcon,
} from 'lucide-react';
import {
  balances,
  categories,
  makeDemo,
  money,
  monthKey,
  splitEvenly,
  today,
  validateExpense,
  type Budget,
  type Category,
  type Data,
  type Expense,
  type Goal,
} from '@/lib/domain';
import { loadHousehold, supabase } from '@/lib/supabase';

type Page = 'Overview' | 'Expenses' | 'Budgets' | 'Savings goals' | 'Household' | 'Settings';
type Modal = 'expense' | 'budget' | 'goal' | 'invite' | 'auth' | 'help' | null;
const icons: Record<Category, LucideIcon> = {
  Groceries: ShoppingBasket,
  'Home & utilities': House,
  Transport: Car,
  'Health & insurance': Heart,
  'Food & dining': Utensils,
  Shopping: ShoppingBag,
  'Family & kids': Baby,
  Entertainment: Clapperboard,
  Other: Wallet,
};
const colors: Record<Category, string> = {
  Groceries: 'green',
  'Home & utilities': 'orange',
  Transport: 'blue',
  'Health & insurance': 'pink',
  'Food & dining': 'yellow',
  Shopping: 'purple',
  'Family & kids': 'purple',
  Entertainment: 'blue',
  Other: 'green',
};
const nav: { label: Page; icon: LucideIcon }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Expenses', icon: Wallet },
  { label: 'Budgets', icon: SlidersHorizontal },
  { label: 'Savings goals', icon: Target },
  { label: 'Household', icon: Users },
];
const demoKey = 'homemint-demo-v1';
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : typeof error === 'object' && error && 'message' in error
      ? String(error.message)
      : 'Something went wrong. Please try again.';

function CategoryIcon({ category }: { category: Category }) {
  const Icon = icons[category] || Wallet;
  return (
    <span className={`category-icon ${colors[category] || 'green'}`}>
      <Icon size={19} strokeWidth={1.8} />
    </span>
  );
}
function Progress({ value, color = 'green' }: { value: number; color?: string }) {
  return (
    <div
      className={`progress ${color}`}
      role="progressbar"
      aria-label="Progress"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
function Logo() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <House size={23} />
        <span>
          <Heart size={10} fill="currentColor" />
        </span>
      </span>
      <span>
        Home<span className="brand-mint">Mint</span>
        <i />
      </span>
    </div>
  );
}
function Dialog({
  title,
  subtitle,
  children,
  close,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    return () => {
      el?.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button className="icon-button" onClick={close} aria-label="Close dialog">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export default function HomeMint() {
  const [data, setData] = useState<Data>(makeDemo);
  const [page, setPage] = useState<Page>('Overview');
  const [month, setMonth] = useState(monthKey());
  const [modal, setModal] = useState<Modal>(null);
  const [editing, setEditing] = useState<Expense | Budget | Goal | null>(null);
  const [userId, setUserId] = useState('you');
  const [sessionEmail, setSessionEmail] = useState('');
  const [needsHousehold, setNeedsHousehold] = useState(false);
  const [ready, setReady] = useState(false);
  const [connectionIssue, setConnectionIssue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState('');
  const [visibility, setVisibility] = useState('all');
  const [category, setCategory] = useState('all');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteToken, setInviteToken] = useState('');
  const [authMode, setAuthMode] = useState<'signin' | 'signup' | 'reset' | 'recovery'>('signin');
  const [confirmDelete, setConfirmDelete] = useState<Expense | null>(null);
  const demo = userId === 'you';
  const me = data.members.find((m) => m.id === userId);
  const owner = me?.role === 'owner';
  const fmt = (n: number) => money(n, data.household.currency);
  const monthly = data.expenses.filter((e) => e.date.startsWith(month));
  const shared = monthly.filter((e) => e.visibility === 'shared');
  const spent = monthly.reduce((sum, e) => sum + e.amount, 0);
  const sharedSpent = shared.reduce((sum, e) => sum + e.amount, 0);
  const budgetTotal = data.budgets.reduce((sum, b) => sum + b.amount, 0);
  const saved = data.goals.reduce((sum, g) => sum + g.saved, 0);
  const visibleExpenses = monthly
    .filter(
      (e) =>
        (visibility === 'all' || e.visibility === visibility) &&
        (category === 'all' || e.category === category) &&
        `${e.title} ${e.category}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const monthLabel = new Date(`${month}-01T12:00:00`).toLocaleDateString('en', {
    month: 'long',
    year: 'numeric',
  });
  const spendingFor = (cat: Category) =>
    shared.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0);

  useEffect(() => {
    let active = true;
    async function init() {
      const token = new URLSearchParams(window.location.search).get('invite') || '';
      setInviteToken(token);
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          if (!active) return;
          setUserId(session.user.id);
          setSessionEmail(session.user.email || '');
          try {
            const remote = await loadHousehold();
            if (active) {
              if (remote) setData(remote);
              setNeedsHousehold(!remote);
            }
          } catch (e) {
            if (active) setConnectionIssue(message(e));
          }
        } else if (active) {
          restoreDemo();
          if (token) setModal('auth');
        }
      } else restoreDemo();
      if (active) setReady(true);
    }
    function restoreDemo() {
      try {
        const raw = localStorage.getItem(demoKey);
        if (raw) {
          const parsed = JSON.parse(raw) as Data;
          if (
            parsed.household?.id === 'demo' &&
            parsed.members?.length &&
            Array.isArray(parsed.expenses) &&
            Array.isArray(parsed.budgets) &&
            Array.isArray(parsed.goals)
          )
            setData(parsed);
        }
      } catch {
        localStorage.removeItem(demoKey);
      }
    }
    void init();
    const subscription = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('recovery');
        setModal('auth');
      }
      if (event === 'SIGNED_OUT') {
        setData(makeDemo());
        setUserId('you');
        setSessionEmail('');
        setNeedsHousehold(false);
        setConnectionIssue('');
        setModal(null);
        setConfirmDelete(null);
        setEditing(null);
        setPage('Overview');
      }
    });
    return () => {
      active = false;
      subscription?.data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    if (ready && demo) {
      try {
        localStorage.setItem(demoKey, JSON.stringify(data));
      } catch {
        queueMicrotask(() =>
          setToast('Browser storage is full. Your latest change may not survive a reload.'),
        );
      }
    }
  }, [data, ready, demo]);
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(''), 6000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  function navigate(next: Page) {
    setPage(next);
    setMenu(false);
    setQuery('');
    setError('');
  }
  function open(next: Modal, item: Expense | Budget | Goal | null = null) {
    setEditing(item);
    setModal(next);
    setError('');
    setInviteLink('');
  }
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const remote = await loadHousehold();
    if (remote) {
      setData(remote);
      setNeedsHousehold(false);
    }
  }
  async function saveRecord(
    table: 'expenses' | 'budgets' | 'goals',
    value: Expense | Budget | Goal,
  ) {
    if (demo)
      setData((prev) => ({
        ...prev,
        [table]: [...prev[table].filter((item) => item.id !== value.id), value],
      }));
    else {
      const { error } = await supabase!
        .from(table)
        .upsert({ ...value, household_id: data.household.id });
      if (error) throw error;
      await refresh();
    }
    setModal(null);
    setToast(
      `${table === 'expenses' ? 'Expense' : table === 'budgets' ? 'Budget' : 'Goal'} saved. Looking good!`,
    );
  }
  async function removeExpense(expense: Expense) {
    if (demo)
      setData((prev) => ({ ...prev, expenses: prev.expenses.filter((e) => e.id !== expense.id) }));
    else {
      const { error } = await supabase!.from('expenses').delete().eq('id', expense.id);
      if (error) throw error;
      await refresh();
    }
    setConfirmDelete(null);
    setToast('Expense deleted.');
  }
  function shiftMonth(amount: number) {
    const date = new Date(`${month}-01T12:00:00`);
    date.setMonth(date.getMonth() + amount);
    setMonth(monthKey(date));
  }
  function exportExpenses() {
    const quote = (value: string | number) =>
      `"${String(value)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      ['Date', 'Description', 'Category', 'Amount', 'Currency', 'Visibility', 'Paid by'],
      ...visibleExpenses.map((e) => [
        e.date,
        e.title,
        e.category,
        e.amount,
        data.household.currency,
        e.visibility,
        data.members.find((m) => m.id === e.owner_id)?.name || 'Member',
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((row) => row.map(quote).join(',')).join('\r\n')], {
        type: 'text/csv;charset=utf-8;',
      }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `homemint-expenses-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setToast('Your expense export is ready.');
  }
  const expenseList = (limit?: number) =>
    visibleExpenses.length ? (
      <div className="expense-table">
        <div className="table-head">
          <span>Transaction</span>
          <span>Category</span>
          <span>Visibility</span>
          <span>Amount</span>
          <span />
        </div>
        {visibleExpenses.slice(0, limit).map((e) => (
          <div className="expense-row" key={e.id}>
            <div className="transaction">
              <CategoryIcon category={e.category} />
              <div>
                <strong>{e.title}</strong>
                <small>
                  {new Date(`${e.date}T12:00:00`).toLocaleDateString('en', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  <span>·</span> Paid by{' '}
                  {e.owner_id === userId
                    ? 'you'
                    : data.members.find((m) => m.id === e.owner_id)?.name || 'a member'}
                </small>
              </div>
            </div>
            <span className="category-label">{e.category}</span>
            <span className={`visibility ${e.visibility}`}>
              {e.visibility === 'private' ? <LockKeyhole size={12} /> : <Users size={12} />}
              {e.visibility === 'private' ? 'Only you' : 'Shared'}
            </span>
            <strong className="expense-amount">−{fmt(e.amount)}</strong>
            <div className="row-actions">
              {e.owner_id === userId && (
                <button
                  aria-label={`Edit ${e.title}`}
                  className="icon-button"
                  onClick={() => open('expense', e)}
                >
                  <Pencil size={15} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    ) : (
      <Empty
        icon={Wallet}
        title="A fresh start"
        text="No expenses here yet. Add one to start seeing the bigger picture."
        action={() => open('expense')}
        label="Add an expense"
      />
    );

  if (connectionIssue)
    return (
      <main className="connection-screen">
        <Logo />
        <section className="panel">
          <ShieldCheck size={32} />
          <h1>Let’s reconnect your home.</h1>
          <p>
            Your account is signed in, but we couldn’t load your household. Check your connection
            and try again. If this is a new installation, complete the database setup first.
          </p>
          <FormError error={connectionIssue} />
          <div className="dialog-actions">
            <button
              className="button secondary"
              onClick={() =>
                void run(async () => {
                  const { error } = await supabase!.auth.signOut();
                  if (error) throw error;
                  setConnectionIssue('');
                  setUserId('you');
                  setData(makeDemo());
                })
              }
            >
              Sign out
            </button>
            <button className="button primary" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
          <FormError error={error} />
        </section>
      </main>
    );
  if (!ready)
    return (
      <main className="connection-screen">
        <Logo />
        <div className="loading-pill" role="status">
          <Leaf size={16} />
          Getting your home ready…
        </div>
      </main>
    );
  return (
    <div className="app-shell">
      {menu && <div className="sidebar-scrim" onClick={() => setMenu(false)} />}
      <aside className={`sidebar ${menu ? 'is-open' : ''}`}>
        <Logo />
        <button className="household-switch" onClick={() => navigate('Household')}>
          <span className="household-icon">
            <House size={19} />
          </span>
          <span>
            <strong>{data.household.name}</strong>
            <small>Your happy little circle</small>
          </span>
          <ChevronDown size={15} />
        </button>
        <div className="nav-caption">YOUR SPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ label, icon: Icon }) => (
            <button
              key={label}
              className={page === label ? 'active' : ''}
              onClick={() => navigate(label)}
            >
              <Icon size={19} strokeWidth={1.7} />
              {label}
              {label === 'Household' && <span className="nav-count">{data.members.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="grow-card">
            <span className="grow-icon">
              <Sprout size={26} />
            </span>
            <strong>Better, together.</strong>
            <p>
              Little plans today.
              <br />
              Big possibilities tomorrow.
            </p>
            <button onClick={() => open('invite')}>
              Invite your family <ArrowRight size={14} />
            </button>
          </div>
          <button
            className={`bottom-nav ${page === 'Settings' ? 'selected' : ''}`}
            onClick={() => navigate('Settings')}
          >
            <Settings size={18} />
            Settings
          </button>
          <button className="bottom-nav" onClick={() => open('help')}>
            <CircleHelp size={18} />A little help
          </button>
          <div className="sidebar-user">
            <span className="avatar">{(me?.name || 'A').slice(0, 1)}</span>
            <div>
              <strong>{me?.name || 'Welcome'}</strong>
              <small>{demo ? 'Exploring HomeMint' : 'Your personal space'}</small>
            </div>
            <button
              className="icon-button"
              aria-label={demo ? 'Sign in' : 'Sign out'}
              onClick={() =>
                demo
                  ? open('auth')
                  : void run(async () => {
                      const { error } = await supabase!.auth.signOut();
                      if (error) throw error;
                      setUserId('you');
                      setSessionEmail('');
                      setNeedsHousehold(false);
                      setData(makeDemo());
                      setPage('Overview');
                    })
              }
            >
              {demo ? <ArrowRight size={18} /> : <LogOut size={17} />}
            </button>
          </div>
        </div>
      </aside>

      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <House size={15} />
            <span>/</span>
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="today-label">
              <span className="live-dot" />A little more peace of mind
            </span>
            <button
              className="icon-button notification-button"
              aria-label="View recurring expenses"
              onClick={() => {
                navigate('Expenses');
                setToast(
                  'Recurring expenses are marked in their edit screen. They are reminders; charges are not added automatically.',
                );
              }}
            >
              <Bell size={19} />
            </button>
            <button
              className="avatar small"
              aria-label="Account settings"
              onClick={() => navigate('Settings')}
            >
              {(me?.name || 'A').slice(0, 1)}
            </button>
          </div>
        </header>
        <main>
          <div className="demo-banner">
            {demo ? (
              <>
                <span>
                  <Sparkles size={14} />
                  <strong>Your next chapter starts here.</strong> You’re exploring a demo household.
                </span>
                <button onClick={() => open('auth')}>
                  Make it yours <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <>
                <span>
                  <ShieldCheck size={14} />
                  Your household is connected. Private expenses stay yours.
                </span>
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await refresh();
                      setToast('Everything is up to date.');
                    })
                  }
                >
                  Refresh
                </button>
              </>
            )}
          </div>
          {error && !modal && !needsHousehold && (
            <div className="error-banner" role="alert">
              {error}
              <button
                className="icon-button"
                onClick={() => setError('')}
                aria-label="Dismiss error"
              >
                <X size={16} />
              </button>
            </div>
          )}
          <section className="page-heading">
            <div>
              <div className="eyebrow">
                {page === 'Overview' ? 'A HOME FOR YOUR MONEY' : 'SMALL STEPS. SHARED DREAMS.'}
              </div>
              <h1>
                {page === 'Overview' ? (
                  <>
                    Good things grow here<span className="heading-dot">.</span>{' '}
                    <span className="wave">🌿</span>
                  </>
                ) : page === 'Household' ? (
                  'Your people. Your home.'
                ) : page === 'Savings goals' ? (
                  'Make room for your dreams.'
                ) : page === 'Budgets' ? (
                  'A plan for everyday living.'
                ) : page === 'Settings' ? (
                  'Make yourself at home.'
                ) : (
                  'Every little thing, in one place.'
                )}
              </h1>
              <p>
                {page === 'Overview'
                  ? `Here’s how your household is doing. A little clarity goes a long way.`
                  : page === 'Expenses'
                    ? 'The shared essentials and the just-for-you moments.'
                    : page === 'Budgets'
                      ? 'Give your money a purpose, with a little room to breathe.'
                      : page === 'Savings goals'
                        ? 'From a rainy day to a sunny getaway. Get there together.'
                        : page === 'Household'
                          ? 'Life changes. Your circle can grow with it.'
                          : 'Your household, your way.'}
              </p>
            </div>
            {!['Household', 'Settings'].includes(page) && (
              <div className="heading-actions">
                {['Overview', 'Expenses', 'Budgets'].includes(page) && (
                  <div className="month-picker">
                    <button aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                      <ChevronLeft size={15} />
                    </button>
                    <CalendarDays size={15} />
                    <span>{monthLabel}</span>
                    <button aria-label="Next month" onClick={() => shiftMonth(1)}>
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
                <button
                  className="button primary"
                  disabled={!ready || (['Budgets', 'Savings goals'].includes(page) && !owner)}
                  onClick={() =>
                    open(
                      page === 'Budgets' ? 'budget' : page === 'Savings goals' ? 'goal' : 'expense',
                    )
                  }
                >
                  <Plus size={17} />
                  {page === 'Budgets'
                    ? 'Set a budget'
                    : page === 'Savings goals'
                      ? 'New goal'
                      : 'Add expense'}
                </button>
              </div>
            )}
          </section>

          {page === 'Overview' && (
            <>
              <section className="stat-grid">
                <div className="stat-card stat-featured">
                  <div className="stat-label">
                    Spent this month{' '}
                    <span>
                      <Wallet size={18} />
                    </span>
                  </div>
                  <div className="stat-value">{fmt(spent)}</div>
                  <div className="stat-foot">
                    <span className="light-pill">
                      <Users size={12} />
                      {monthly.length} expenses
                    </span>
                    <span>shared + your private</span>
                  </div>
                  <div className="stat-decor" />
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Household budget left{' '}
                    <span className="stat-icon green">
                      <ShoppingBasket size={18} />
                    </span>
                  </div>
                  <div className="stat-value">{fmt(budgetTotal - sharedSpent)}</div>
                  <div className="stat-foot">
                    <span className={`pill ${sharedSpent > budgetTotal ? 'warning' : ''}`}>
                      <span className="tiny-dot" />
                      {budgetTotal
                        ? Math.round((Math.max(0, budgetTotal - sharedSpent) / budgetTotal) * 100)
                        : 0}
                      % left
                    </span>
                    <span>of {fmt(budgetTotal)}</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Tucked away for dreams{' '}
                    <span className="stat-icon purple">
                      <Sprout size={18} />
                    </span>
                  </div>
                  <div className="stat-value">{fmt(saved)}</div>
                  <div className="stat-foot">
                    <span className="tiny-trend">
                      <TrendingUp size={14} />
                      Growing together
                    </span>
                    <span>{data.goals.length} goals</span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">
                    Your shared expenses{' '}
                    <span className="stat-icon orange">
                      <Users size={18} />
                    </span>
                  </div>
                  <div className="stat-value">{fmt(sharedSpent)}</div>
                  <div className="stat-foot">
                    <div className="avatar-stack">
                      {data.members.slice(0, 3).map((m, i) => (
                        <span className={`avatar tiny avatar-${i}`} key={m.id}>
                          {m.name[0]}
                        </span>
                      ))}
                    </div>
                    <span>One household. One team.</span>
                  </div>
                </div>
              </section>
              <div className="overview-grid">
                <section className="panel spending-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Where it all goes</h2>
                      <p>A little perspective on your spending</p>
                    </div>
                    <span className="subtle-chip">
                      This month <ChevronDown size={12} />
                    </span>
                  </div>
                  <div className="spending-content">
                    <SpendingChart expenses={monthly} total={spent} fmt={fmt} />
                    <div className="spending-legend">
                      {categories
                        .map((cat) => ({
                          cat,
                          total: monthly
                            .filter((e) => e.category === cat)
                            .reduce((s, e) => s + e.amount, 0),
                        }))
                        .filter((c) => c.total > 0)
                        .sort((a, b) => b.total - a.total)
                        .map(({ cat, total }) => (
                          <div key={cat}>
                            <span className={`legend-dot ${colors[cat]}`} />
                            <span>{cat}</span>
                            <strong>{fmt(total)}</strong>
                            <small>{Math.round((total / spent) * 100)}%</small>
                          </div>
                        ))}
                      {spent === 0 && (
                        <p className="muted">Your spending story starts with your first expense.</p>
                      )}
                    </div>
                  </div>
                  <div className="panel-note">
                    <Leaf size={15} />
                    <span>Awareness is the first step to a healthier money habit.</span>
                  </div>
                </section>
                <section className="panel budget-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Staying on track</h2>
                      <p>Your monthly household budgets</p>
                    </div>
                    <button className="text-button" onClick={() => navigate('Budgets')}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  <div className="budget-preview">
                    {data.budgets.slice(0, 3).map((b) => (
                      <BudgetRow key={b.id} budget={b} spent={spendingFor(b.category)} fmt={fmt} />
                    ))}
                    {!data.budgets.length && (
                      <Empty
                        icon={SlidersHorizontal}
                        title="A little planning helps"
                        text="Set a monthly limit for your household categories."
                      />
                    )}
                  </div>
                  <div className="budget-summary">
                    <span className="status-icon">
                      <Check size={13} />
                    </span>
                    {budgetTotal === 0
                      ? 'Start with a budget that feels right.'
                      : sharedSpent <= budgetTotal
                        ? 'You’re making space for what matters.'
                        : 'A good time to revisit your spending plan.'}
                  </div>
                </section>
              </div>
              <div className="overview-grid lower-grid">
                <section className="panel recent-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>The latest little things</h2>
                      <p>Recent expenses, all in one place</p>
                    </div>
                    <button className="text-button" onClick={() => navigate('Expenses')}>
                      View all <ArrowRight size={14} />
                    </button>
                  </div>
                  {expenseList(4)}
                </section>
                <section className="panel goals-preview">
                  <div className="panel-heading">
                    <div>
                      <h2>Dreams in the making</h2>
                      <p>A little closer, every day</p>
                    </div>
                    <button
                      className="icon-button"
                      aria-label="View savings goals"
                      onClick={() => navigate('Savings goals')}
                    >
                      <ArrowUpRight size={19} />
                    </button>
                  </div>
                  {data.goals.slice(0, 2).map((g) => (
                    <div className="mini-goal" key={g.id}>
                      <span className="goal-emoji">{g.emoji}</span>
                      <div>
                        <strong>{g.name}</strong>
                        <div className="goal-numbers">
                          <span>
                            {fmt(g.saved)} <small>of {fmt(g.target)}</small>
                          </span>
                          <b>{Math.round((g.saved / g.target) * 100)}%</b>
                        </div>
                        <Progress
                          value={(g.saved / g.target) * 100}
                          color={g.emoji === '🏡' ? 'purple' : 'green'}
                        />
                      </div>
                    </div>
                  ))}
                  {!data.goals.length && (
                    <Empty
                      icon={Target}
                      title="What are you dreaming of?"
                      text="Give your next milestone a place to grow."
                    />
                  )}
                  <button className="goal-footer" onClick={() => navigate('Savings goals')}>
                    Every small step counts <Heart size={13} />
                  </button>
                </section>
              </div>
              <div className="together-banner">
                <span className="together-symbol">
                  <Users size={24} />
                </span>
                <div>
                  <strong>Shared life. Shared plans. Your own space.</strong>
                  <p>Manage money together, while keeping personal expenses just for you.</p>
                </div>
                <button className="button secondary" onClick={() => navigate('Household')}>
                  Meet your household <ArrowRight size={14} />
                </button>
                <div className="banner-leaves">
                  <Sprout size={82} strokeWidth={1} />
                </div>
              </div>
            </>
          )}

          {page === 'Expenses' && (
            <section className="panel">
              <div className="expense-toolbar">
                <div className="filter-tabs" aria-label="Expense visibility">
                  {[
                    ['all', 'All expenses'],
                    ['shared', 'Shared'],
                    ['private', 'Only me'],
                  ].map(([value, label]) => (
                    <button
                      className={visibility === value ? 'active' : ''}
                      key={value}
                      onClick={() => setVisibility(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="table-tools">
                  <label className="search-field">
                    <Search size={16} />
                    <input
                      aria-label="Search expenses"
                      placeholder="Find an expense…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </label>
                  <select
                    aria-label="Filter by category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="all">All categories</option>
                    {categories.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    className="icon-button"
                    aria-label="Export expenses as CSV"
                    onClick={exportExpenses}
                  >
                    <Download size={18} />
                  </button>
                </div>
              </div>
              {expenseList()}
              <div className="table-footer">
                <span>
                  {visibleExpenses.length} expenses · {monthLabel}
                </span>
                <strong>Total {fmt(visibleExpenses.reduce((s, e) => s + e.amount, 0))}</strong>
              </div>
            </section>
          )}

          {page === 'Budgets' && (
            <>
              <div className="info-strip">
                <ShieldCheck size={18} />
                <span>
                  Budgets track shared expenses. Private spending stays out of household totals.
                  Limits repeat each month.
                  {!owner && ' Only the household owner can change budgets.'}
                </span>
              </div>
              <div className="card-grid">
                {data.budgets.map((b) => (
                  <section className="panel standalone-budget" key={b.id}>
                    <div className="standalone-heading">
                      <CategoryIcon category={b.category} />
                      <button
                        disabled={!owner}
                        className="icon-button"
                        aria-label={`Edit ${b.category} budget`}
                        onClick={() => open('budget', b)}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                    <BudgetRow budget={b} spent={spendingFor(b.category)} fmt={fmt} />
                    <p className={spendingFor(b.category) > b.amount ? 'over-budget' : 'muted'}>
                      {fmt(Math.abs(b.amount - spendingFor(b.category)))}{' '}
                      {spendingFor(b.category) > b.amount
                        ? 'over budget — time for a little adjustment'
                        : 'left to spend this month'}
                    </p>
                  </section>
                ))}
                {owner && (
                  <button className="add-card" onClick={() => open('budget')}>
                    <span>
                      <Plus size={24} />
                    </span>
                    <strong>A little more structure</strong>
                    <p>Set a budget for another category</p>
                  </button>
                )}
              </div>
            </>
          )}
          {page === 'Savings goals' && (
            <>
              <div className="info-strip">
                <Sprout size={18} />
                <span>
                  Track savings you’ve set aside yourself. HomeMint does not move money.
                  {!owner && ' The household owner can update goals.'}
                </span>
              </div>
              <div className="card-grid">
                {data.goals.map((g) => (
                  <section className="panel goal-card" key={g.id}>
                    <div className="standalone-heading">
                      <span className="large-emoji">{g.emoji}</span>
                      <button
                        className="icon-button"
                        disabled={!owner}
                        aria-label={`Edit ${g.name}`}
                        onClick={() => open('goal', g)}
                      >
                        <Pencil size={16} />
                      </button>
                    </div>
                    <h2>{g.name}</h2>
                    <p className="goal-total">
                      {fmt(g.saved)} <small>of {fmt(g.target)}</small>
                    </p>
                    <Progress value={(g.saved / g.target) * 100} />
                    <div className="goal-bottom">
                      <span>{Math.round((g.saved / g.target) * 100)}% of the way there</span>
                      <span>{g.saved >= g.target ? 'You made it! 🎉' : '🌱 Keep growing'}</span>
                    </div>
                    <button
                      className="button secondary full-width"
                      disabled={!owner}
                      onClick={() => open('goal', g)}
                    >
                      Update savings <Plus size={15} />
                    </button>
                  </section>
                ))}
                {owner && (
                  <button className="add-card" onClick={() => open('goal')}>
                    <span>
                      <Target size={24} />
                    </span>
                    <strong>Plant a new dream</strong>
                    <p>What would you love to save for?</p>
                  </button>
                )}
              </div>
            </>
          )}
          {page === 'Household' && (
            <>
              <section className="panel household-hero">
                <div className="household-hero-icon">
                  <House size={35} />
                </div>
                <div>
                  <span className="eyebrow">YOUR INNER CIRCLE</span>
                  <h2>{data.household.name}</h2>
                  <p>{data.members.length} people, making life happen together.</p>
                </div>
                <button className="button primary" disabled={!owner} onClick={() => open('invite')}>
                  <Plus size={17} />
                  Invite a member
                </button>
              </section>
              <div className="household-columns">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>A place for everyone</h2>
                      <p>Shared access, personal privacy</p>
                    </div>
                    <Users size={20} />
                  </div>
                  {data.members.map((m, i) => (
                    <div className="member-row" key={m.id}>
                      <span className={`avatar avatar-${i}`}>{m.name[0]}</span>
                      <div>
                        <strong>
                          {m.name} {m.id === userId && <small>(you)</small>}
                        </strong>
                        <small>{m.email}</small>
                      </div>
                      <span className="role-pill">{m.role === 'owner' ? 'Owner' : 'Member'}</span>
                    </div>
                  ))}
                  <div className="panel-note">
                    <LockKeyhole size={15} />
                    Only the person who adds a private expense can see it.
                  </div>
                </section>
                <section className="panel balances-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Keeping things fair</h2>
                      <p>Net balances from all shared expenses</p>
                    </div>
                    <ArrowDownLeft size={20} />
                  </div>
                  {Object.entries(
                    balances(
                      data.expenses,
                      data.members.map((m) => m.id),
                    ),
                  ).map(([id, amount]) => (
                    <div className="balance-row" key={id}>
                      <span>{data.members.find((m) => m.id === id)?.name}</span>
                      <div>
                        <strong className={amount >= 0 ? 'positive' : ''}>
                          {fmt(Math.abs(amount))}
                        </strong>
                        <small>
                          {amount > 0
                            ? 'to receive'
                            : amount < 0
                              ? 'to contribute'
                              : 'all balanced'}
                        </small>
                      </div>
                    </div>
                  ))}
                  <div className="panel-note">
                    Balances are a guide. Payment and settlement tracking are not yet connected.
                  </div>
                </section>
              </div>
            </>
          )}
          {page === 'Settings' && (
            <section className="panel settings-panel">
              <div className="panel-heading">
                <div>
                  <h2>The details that make it yours</h2>
                  <p>
                    {owner
                      ? 'Personalize your household.'
                      : 'Only the household owner can update these settings.'}
                  </p>
                </div>
                <Settings size={20} />
              </div>
              <form
                key={data.household.id}
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  void run(async () => {
                    const currency = String(form.get('currency'));
                    if (
                      currency !== data.household.currency &&
                      (data.expenses.length || data.goals.length || data.budgets.length)
                    )
                      throw new Error(
                        'Currency cannot change while you have financial records. Amounts are not automatically converted.',
                      );
                    const household = {
                      ...data.household,
                      name: String(form.get('name')).trim(),
                      currency,
                      monthly_income: Number(form.get('income')),
                    };
                    if (!demo) {
                      const { error } = await supabase!
                        .from('households')
                        .update({
                          name: household.name,
                          currency,
                          monthly_income: household.monthly_income,
                        })
                        .eq('id', household.id);
                      if (error) throw error;
                    }
                    setData((prev) => ({ ...prev, household }));
                    setToast('Your household settings are saved.');
                  });
                }}
              >
                <fieldset disabled={!owner || busy}>
                  <label>
                    Household name
                    <input name="name" defaultValue={data.household.name} required maxLength={80} />
                  </label>
                  <div className="form-grid">
                    <label>
                      Currency
                      <select name="currency" defaultValue={data.household.currency}>
                        {['INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD'].map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Monthly household income
                      <input
                        type="number"
                        name="income"
                        min="0"
                        max="100000000"
                        step="0.01"
                        defaultValue={data.household.monthly_income}
                        required
                      />
                    </label>
                  </div>
                  <p className="field-hint">
                    Choose your currency before adding financial records. Changing currency does not
                    convert amounts. Income is visible to household members.
                  </p>
                  <button className="button primary" type="submit">
                    {busy ? 'Saving…' : 'Save changes'}
                    <Check size={16} />
                  </button>
                </fieldset>
              </form>
              <div className="settings-account">
                <div>
                  <strong>{demo ? 'Ready for your own household?' : sessionEmail}</strong>
                  <p>
                    {demo
                      ? 'Create an account to save securely and invite your family.'
                      : 'Your account is securely managed by Supabase.'}
                  </p>
                </div>
                {demo && (
                  <button className="button secondary" onClick={() => open('auth')}>
                    Get started <ArrowRight size={15} />
                  </button>
                )}
              </div>
            </section>
          )}
          <footer className="main-footer">
            <span>
              <Sprout size={14} />
              Made for the life you’re building.
            </span>
            <span>A little clarity. A happier home.</span>
          </footer>
        </main>
      </div>

      {modal === 'expense' && (
        <Dialog
          title={editing ? 'The little details' : 'Add a little expense'}
          subtitle="Every expense has a place. You choose who sees it."
          close={() => !busy && setModal(null)}
        >
          <ExpenseForm
            expense={editing as Expense | null}
            data={data}
            userId={userId}
            busy={busy}
            error={error}
            onSave={(value) => void run(() => saveRecord('expenses', value))}
            onDelete={
              editing
                ? () => {
                    setConfirmDelete(editing as Expense);
                    setModal(null);
                  }
                : undefined
            }
          />
        </Dialog>
      )}
      {modal === 'budget' && (
        <Dialog
          title={editing ? 'A little budget adjustment' : 'Give your money a purpose'}
          subtitle="Set a monthly limit for shared household spending."
          close={() => !busy && setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                const cat = String(form.get('category')) as Category;
                const existing = data.budgets.find((b) => b.category === cat);
                await saveRecord('budgets', {
                  id: editing?.id || existing?.id || crypto.randomUUID(),
                  category: cat,
                  amount: Number(form.get('amount')),
                });
              });
            }}
          >
            <label>
              Category
              <select
                name="category"
                defaultValue={(editing as Budget)?.category || categories[0]}
                disabled={!!editing}
              >
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              {editing && (
                <input type="hidden" name="category" value={(editing as Budget).category} />
              )}
            </label>
            <label>
              Monthly budget ({data.household.currency})
              <input
                name="amount"
                type="number"
                min="0.01"
                max="100000000"
                step="0.01"
                required
                defaultValue={(editing as Budget)?.amount}
                placeholder="10,000"
              />
            </label>
            <p className="field-hint">
              An existing category budget will be updated. This limit applies to every month.
            </p>
            <FormError error={error} />
            <button className="button primary full-width" disabled={busy}>
              {' '}
              {busy ? 'Saving…' : 'Save budget'}
              <Check size={16} />
            </button>
          </form>
        </Dialog>
      )}
      {modal === 'goal' && (
        <Dialog
          title={editing ? 'One step closer' : 'Plant a new dream'}
          subtitle="Small amounts can become something wonderful."
          close={() => !busy && setModal(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(() =>
                saveRecord('goals', {
                  id: editing?.id || crypto.randomUUID(),
                  name: String(form.get('name')).trim(),
                  emoji: String(form.get('emoji')),
                  target: Number(form.get('target')),
                  saved: Number(form.get('saved')),
                }),
              );
            }}
          >
            <div className="form-grid goal-name-grid">
              <label>
                A little symbol
                <select name="emoji" defaultValue={(editing as Goal)?.emoji || '🌱'}>
                  {['🌱', '🌴', '🏡', '🎓', '🚗', '👶', '💍', '🛟'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                What’s the dream?
                <input
                  name="name"
                  required
                  maxLength={80}
                  placeholder="Our first home"
                  defaultValue={(editing as Goal)?.name}
                />
              </label>
            </div>
            <div className="form-grid">
              <label>
                Target ({data.household.currency})
                <input
                  name="target"
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  required
                  defaultValue={(editing as Goal)?.target}
                />
              </label>
              <label>
                Already saved
                <input
                  name="saved"
                  type="number"
                  min="0"
                  max="100000000"
                  step="0.01"
                  required
                  defaultValue={(editing as Goal)?.saved || 0}
                />
              </label>
            </div>
            <FormError error={error} />
            <button className="button primary full-width" disabled={busy}>
              {busy ? 'Saving…' : 'Save your dream'}
              <Sprout size={16} />
            </button>
          </form>
        </Dialog>
      )}
      {modal === 'invite' && (
        <Dialog
          title="Make a little more room"
          subtitle="Invite someone to share in your household’s plans."
          close={() => !busy && setModal(null)}
        >
          {demo ? (
            <div className="invite-intro">
              <span className="large-emoji">🏡</span>
              <p>
                Your real family deserves a space of their own. Create your account first, then
                invite them with a secure link.
              </p>
              <button className="button primary full-width" onClick={() => open('auth')}>
                Create your household <ArrowRight size={16} />
              </button>
            </div>
          ) : !owner ? (
            <p>Only the household owner can invite new members.</p>
          ) : inviteLink ? (
            <div className="invite-result">
              <div className="success-note">
                <Check size={18} />
                Your invitation link is ready.
              </div>
              <label>
                Share this link
                <input value={inviteLink} readOnly onFocus={(e) => e.target.select()} />
              </label>
              <button
                className="button primary full-width"
                onClick={() =>
                  void run(async () => {
                    await navigator.clipboard.writeText(inviteLink);
                    setToast('Invitation copied. Share it with your person.');
                  })
                }
              >
                <Copy size={16} />
                Copy invitation
              </button>
              <p className="field-hint">
                Valid for 7 days, for the email address you entered. Share it yourself; no email has
                been sent.
              </p>
              <FormError error={error} />
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void run(async () => {
                  const { data: invite, error } = await supabase!
                    .from('invitations')
                    .insert({
                      household_id: data.household.id,
                      email: String(form.get('email')).trim().toLowerCase(),
                    })
                    .select('token')
                    .single();
                  if (error) throw error;
                  setInviteLink(`${window.location.origin}/?invite=${invite.token}`);
                });
              }}
            >
              <label>
                Their email address
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  placeholder="someone@home.com"
                />
              </label>
              <div className="privacy-note">
                <ShieldCheck size={18} />
                <span>
                  They can view shared expenses and add their own. Your private expenses stay
                  private.
                </span>
              </div>
              <FormError error={error} />
              <button className="button primary full-width" disabled={busy}>
                {busy ? 'Creating…' : 'Create invitation link'}
                <ArrowRight size={16} />
              </button>
            </form>
          )}
        </Dialog>
      )}
      {modal === 'auth' && (
        <Dialog
          title={
            authMode === 'recovery'
              ? 'A fresh password'
              : authMode === 'reset'
                ? 'Let’s get you back in'
                : authMode === 'signup'
                  ? 'Your next chapter starts here'
                  : 'Welcome home'
          }
          subtitle={
            inviteToken
              ? 'Sign in with your invited email to join your household.'
              : 'A calmer way to manage money, together.'
          }
          close={() => !busy && setModal(null)}
        >
          {!supabase ? (
            <div className="setup-note">
              <Sprout size={34} />
              <h3>Your preview is ready to explore.</h3>
              <p>
                Account creation becomes available once this site is connected to Supabase. For now,
                your demo changes are saved in this browser.
              </p>
              <button className="button primary full-width" onClick={() => setModal(null)}>
                Keep exploring <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                void run(async () => {
                  const email = String(form.get('email'));
                  const password = String(form.get('password'));
                  if (authMode === 'reset') {
                    const { error } = await supabase!.auth.resetPasswordForEmail(email, {
                      redirectTo: window.location.origin,
                    });
                    if (error) throw error;
                    setToast('Check your email for a password reset link.');
                    setModal(null);
                    return;
                  }
                  if (authMode === 'recovery') {
                    const { error } = await supabase!.auth.updateUser({ password });
                    if (error) throw error;
                    setToast('Your password has been updated.');
                    setModal(null);
                    return;
                  }
                  const result =
                    authMode === 'signup'
                      ? await supabase!.auth.signUp({
                          email,
                          password,
                          options: {
                            emailRedirectTo: `${window.location.origin}/${inviteToken ? `?invite=${encodeURIComponent(inviteToken)}` : ''}`,
                          },
                        })
                      : await supabase!.auth.signInWithPassword({ email, password });
                  if (result.error) throw result.error;
                  if (!result.data.session) {
                    setToast('Check your email to confirm your account, then sign in here.');
                    setAuthMode('signin');
                    return;
                  }
                  setUserId(result.data.session.user.id);
                  setSessionEmail(result.data.session.user.email || '');
                  const remote = await loadHousehold();
                  if (remote) setData(remote);
                  setNeedsHousehold(!remote);
                  setModal(null);
                });
              }}
            >
              {authMode !== 'recovery' && (
                <label>
                  Email address
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </label>
              )}
              {authMode !== 'reset' && (
                <label>
                  Password
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
                    placeholder="At least 8 characters"
                  />
                </label>
              )}
              <FormError error={error} />
              <button className="button primary full-width" disabled={busy}>
                {busy
                  ? 'Just a moment…'
                  : authMode === 'signup'
                    ? 'Create account'
                    : authMode === 'reset'
                      ? 'Send reset link'
                      : authMode === 'recovery'
                        ? 'Update password'
                        : 'Sign in'}
                <ArrowRight size={16} />
              </button>
              <div className="auth-links">
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
                    setError('');
                  }}
                >
                  {authMode === 'signup'
                    ? 'Already have an account? Sign in'
                    : 'New here? Create an account'}
                </button>
                {authMode === 'signin' && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setAuthMode('reset')}
                  >
                    Forgot password?
                  </button>
                )}
              </div>
            </form>
          )}
        </Dialog>
      )}
      {needsHousehold && !modal && (
        <Dialog
          title={inviteToken ? 'Your circle is waiting' : 'Let’s make this your home'}
          subtitle={
            inviteToken
              ? 'Choose the name your family will see.'
              : 'Start small. You can grow and customize this anytime.'
          }
          close={() => {
            void run(async () => {
              await supabase!.auth.signOut();
              setNeedsHousehold(false);
              setUserId('you');
              setData(makeDemo());
            });
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void run(async () => {
                const result = inviteToken
                  ? await supabase!.rpc('accept_invitation', {
                      invite_token: inviteToken,
                      display_name: String(form.get('display_name')),
                    })
                  : await supabase!.rpc('create_household', {
                      household_name: String(form.get('household_name')),
                      display_name: String(form.get('display_name')),
                      chosen_currency: String(form.get('currency')),
                    });
                if (result.error) throw result.error;
                await refresh();
                setInviteToken('');
                window.history.replaceState({}, '', '/');
                setToast('Welcome to your household. Make yourself at home.');
              });
            }}
          >
            <label>
              Your name
              <input
                name="display_name"
                maxLength={80}
                required
                placeholder="What should we call you?"
              />
            </label>
            {!inviteToken && (
              <>
                <label>
                  Household name
                  <input
                    name="household_name"
                    maxLength={80}
                    required
                    placeholder="The Green family"
                  />
                </label>
                <label>
                  Your currency
                  <select name="currency" defaultValue="INR">
                    {['INR', 'USD', 'GBP', 'EUR', 'AED', 'CAD', 'AUD'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </>
            )}
            <FormError error={error} />
            <button className="button primary full-width" disabled={busy}>
              {busy ? 'Getting ready…' : inviteToken ? 'Join household' : 'Create household'}
              <House size={16} />
            </button>
          </form>
        </Dialog>
      )}
      {modal === 'help' && (
        <Dialog title="A little help, a lot of clarity" close={() => setModal(null)}>
          <div className="help-content">
            <h3>Start with the everyday</h3>
            <p>
              Add your groceries, rent, insurance, and little treats. Choose shared for household
              expenses or private for things only you should see.
            </p>
            <h3>Keep things fair</h3>
            <p>
              The person adding an expense is its payer. Split it equally or enter custom amounts.
              The household page shows what each person owes or should receive.
            </p>
            <h3>Make plans together</h3>
            <p>
              The owner sets recurring monthly budgets and updates savings goals. Invite family
              members with a link tied to their email address.
            </p>
            <h3>Your space is yours</h3>
            <p>
              Members cannot see each other’s private expenses. Shared records are visible to
              everyone, but only the payer can edit them.
            </p>
            <p className="field-hint">
              Recurring labels are reminders only. HomeMint does not connect to banks, transfer
              money, or create automatic charges.
            </p>
          </div>
        </Dialog>
      )}
      {confirmDelete && (
        <Dialog
          title="Delete this expense?"
          subtitle={`“${confirmDelete.title}” will be removed from your records and split balances.`}
          close={() => !busy && setConfirmDelete(null)}
        >
          <FormError error={error} />
          <div className="dialog-actions">
            <button className="button secondary" onClick={() => setConfirmDelete(null)}>
              Keep expense
            </button>
            <button
              className="button danger"
              disabled={busy}
              onClick={() => void run(() => removeExpense(confirmDelete))}
            >
              {busy ? 'Deleting…' : 'Delete expense'}
              <Trash2 size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {!ready && (
        <div className="loading-pill" role="status">
          <Leaf size={16} />
          Getting your home ready…
        </div>
      )}
    </div>
  );
}

function FormError({ error }: { error: string }) {
  return error ? (
    <p className="form-error" role="alert">
      {error}
    </p>
  ) : null;
}
function Empty({
  icon: Icon,
  title,
  text,
  action,
  label,
}: {
  icon: LucideIcon;
  title: string;
  text: string;
  action?: () => void;
  label?: string;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action && (
        <button className="button secondary" onClick={action}>
          <Plus size={15} />
          {label}
        </button>
      )}
    </div>
  );
}
function BudgetRow({
  budget,
  spent,
  fmt,
}: {
  budget: Budget;
  spent: number;
  fmt: (n: number) => string;
}) {
  return (
    <div className="budget-row">
      <div>
        <span>
          <span className={`legend-dot ${colors[budget.category]}`} />
          <strong>{budget.category}</strong>
        </span>
        <span>
          <b>{fmt(spent)}</b>
          <small> / {fmt(budget.amount)}</small>
        </span>
      </div>
      <Progress
        value={(spent / budget.amount) * 100}
        color={spent > budget.amount ? 'pink' : colors[budget.category]}
      />
    </div>
  );
}
const chartColors: Record<string, string> = {
  green: '#78a891',
  orange: '#edbf88',
  blue: '#96b7cb',
  pink: '#dca5af',
  yellow: '#d7ca91',
  purple: '#b5a8cd',
};
function SpendingChart({
  expenses,
  total,
  fmt,
}: {
  expenses: Expense[];
  total: number;
  fmt: (n: number) => string;
}) {
  let cursor = 0;
  const segments = categories.map((cat) => {
    const value = expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
    const start = cursor;
    cursor += total ? (value / total) * 100 : 0;
    return `${chartColors[colors[cat]]} ${start}% ${cursor}%`;
  });
  return (
    <div className="donut-wrap">
      <div
        className="donut"
        role="img"
        aria-label={`Total monthly spending: ${fmt(total)}`}
        style={{ background: total ? `conic-gradient(${segments.join(',')})` : '#edf1ec' }}
      >
        <div>
          <small>Total spending</small>
          <strong>{fmt(total)}</strong>
          <span>{expenses.length} little moments</span>
        </div>
      </div>
    </div>
  );
}
function ExpenseForm({
  expense,
  data,
  userId,
  busy,
  error,
  onSave,
  onDelete,
}: {
  expense: Expense | null;
  data: Data;
  userId: string;
  busy: boolean;
  error: string;
  onSave: (expense: Expense) => void;
  onDelete?: () => void;
}) {
  const [visibility, setVisibility] = useState(expense?.visibility || 'shared');
  const [selected, setSelected] = useState(
    expense ? Object.keys(expense.splits) : data.members.map((m) => m.id),
  );
  const [splitMode, setSplitMode] = useState(expense ? 'custom' : 'equal');
  const [amount, setAmount] = useState(String(expense?.amount || ''));
  const [localError, setLocalError] = useState('');
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLocalError('');
    const form = new FormData(e.currentTarget);
    try {
      const total = Math.round(Number(amount) * 100) / 100;
      const splits =
        visibility === 'private'
          ? { [userId]: total }
          : splitMode === 'equal'
            ? splitEvenly(total, selected)
            : Object.fromEntries(selected.map((id) => [id, Number(form.get(`split-${id}`))]));
      const value: Expense = {
        id: expense?.id || crypto.randomUUID(),
        title: String(form.get('title')).trim(),
        amount: total,
        category: String(form.get('category')) as Category,
        date: String(form.get('date')),
        owner_id: userId,
        visibility,
        splits,
        recurring: form.get('recurring') === 'on',
      };
      validateExpense(
        value,
        data.members.map((m) => m.id),
      );
      onSave(value);
    } catch (error) {
      setLocalError(message(error));
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        What was it for?
        <input
          name="title"
          placeholder="The weekly grocery run"
          maxLength={120}
          defaultValue={expense?.title}
          required
          autoFocus
        />
      </label>
      <div className="form-grid">
        <label>
          Amount ({data.household.currency})
          <input
            name="amount"
            type="number"
            inputMode="decimal"
            min="0.01"
            max="100000000"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
            placeholder="0.00"
          />
        </label>
        <label>
          Date
          <input name="date" type="date" defaultValue={expense?.date || today()} required />
        </label>
      </div>
      <label>
        Category
        <select name="category" defaultValue={expense?.category || 'Groceries'}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <div className="label-text">Who can see this?</div>
      <div className="visibility-options">
        <button
          type="button"
          className={visibility === 'shared' ? 'chosen' : ''}
          onClick={() => setVisibility('shared')}
        >
          <Users size={18} />
          <span>
            <strong>Household</strong>
            <small>Better together</small>
          </span>
          {visibility === 'shared' && <Check size={16} />}
        </button>
        <button
          type="button"
          className={visibility === 'private' ? 'chosen' : ''}
          onClick={() => setVisibility('private')}
        >
          <LockKeyhole size={18} />
          <span>
            <strong>Only me</strong>
            <small>Just for you</small>
          </span>
          {visibility === 'private' && <Check size={16} />}
        </button>
      </div>
      {visibility === 'shared' && (
        <div className="split-section">
          <div className="split-heading">
            <strong>Split the expense</strong>
            <select
              aria-label="Split method"
              value={splitMode}
              onChange={(e) => setSplitMode(e.target.value)}
            >
              <option value="equal">Equally</option>
              <option value="custom">Custom amounts</option>
            </select>
          </div>
          {data.members.map((member) => (
            <div className="split-member" key={member.id}>
              <label>
                <input
                  type="checkbox"
                  checked={selected.includes(member.id)}
                  onChange={(e) =>
                    setSelected((prev) =>
                      e.target.checked
                        ? [...prev, member.id]
                        : prev.filter((id) => id !== member.id),
                    )
                  }
                />
                <span>
                  {member.name}
                  {member.id === userId ? ' (you)' : ''}
                </span>
              </label>
              {selected.includes(member.id) &&
                (splitMode === 'custom' ? (
                  <input
                    type="number"
                    aria-label={`${member.name}'s share`}
                    name={`split-${member.id}`}
                    min="0"
                    step="0.01"
                    required
                    defaultValue={expense?.splits[member.id] || 0}
                  />
                ) : (
                  <span>
                    {Number(amount) > 0
                      ? money(
                          splitEvenly(Number(amount), selected)[member.id],
                          data.household.currency,
                        )
                      : '—'}
                  </span>
                ))}
            </div>
          ))}
        </div>
      )}
      <label className="checkbox-label">
        <input type="checkbox" name="recurring" defaultChecked={expense?.recurring} />
        <span>
          Recurring expense <small>A reminder label, no automatic charges</small>
        </span>
      </label>
      <div className="privacy-note">
        <ShieldCheck size={16} />
        <span>
          {visibility === 'private'
            ? 'Only you can view this expense, even in shared totals.'
            : 'Visible to your household. Only you can edit it.'}
        </span>
      </div>
      <FormError error={localError || error} />
      <div className="dialog-actions">
        {onDelete && (
          <button
            type="button"
            className="icon-button delete-button"
            aria-label="Delete expense"
            onClick={onDelete}
          >
            <Trash2 size={18} />
          </button>
        )}
        <button className="button primary" disabled={busy} type="submit">
          {busy ? 'Saving…' : expense ? 'Save changes' : 'Add expense'}
          <Check size={17} />
        </button>
      </div>
    </form>
  );
}
