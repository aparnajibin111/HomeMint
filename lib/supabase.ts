import { createClient } from '@supabase/supabase-js';
import type { Data, Expense, Household, Member } from './domain';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;
export async function loadHousehold(): Promise<Data | null> {
  if (!supabase) return null;
  const { data: households, error } = await supabase.from('households').select('*').limit(1);
  if (error) throw error;
  const household = households?.[0] as Household | undefined;
  if (!household) return null;
  const [members, expenses, budgets, goals] = await Promise.all([
    supabase.rpc('household_members', { target_household: household.id }),
    supabase.from('expenses').select('*').eq('household_id', household.id),
    supabase.from('budgets').select('*').eq('household_id', household.id),
    supabase.from('goals').select('*').eq('household_id', household.id),
  ]);
  for (const result of [members, expenses, budgets, goals]) if (result.error) throw result.error;
  return {
    household,
    members: members.data as Member[],
    expenses: expenses.data as Expense[],
    budgets: budgets.data || [],
    goals: goals.data || [],
  };
}
