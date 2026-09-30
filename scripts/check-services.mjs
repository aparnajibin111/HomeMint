import { readFileSync } from 'node:fs';
const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
for (const [name, url, headers] of [
  [
    'Supabase auth',
    `${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`,
    { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  ],
  [
    'Supabase schema',
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/households?select=id&limit=1`,
    { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  ],
  [
    'Supabase household function',
    `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/household_members?target_household=00000000-0000-0000-0000-000000000000`,
    { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  ],
  ['Vercel site', 'https://home-mint.vercel.app/', {}],
]) {
  try {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
    console.log(`${name}: HTTP ${response.status}`);
    if (!response.ok) console.log((await response.text()).slice(0, 300));
  } catch (error) {
    console.error(`${name}: ${error.message}`);
    process.exitCode = 1;
  }
}
