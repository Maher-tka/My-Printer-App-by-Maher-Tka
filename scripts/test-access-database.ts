import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001'
const alice = '00000000-0000-0000-0000-000000000002'
const bob = '00000000-0000-0000-0000-000000000003'
const unverified = '00000000-0000-0000-0000-000000000004'
const migration = await readFile(
  new URL('../supabase/migrations/20261002054818_printer_access.sql', import.meta.url),
  'utf8'
)
await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, email_confirmed_at timestamptz, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`)
await db.exec(migration)
for (const [id, email, verified] of [
  [owner, 'owner@example.com', true],
  [alice, 'alice@example.com', true],
  [bob, 'bob@example.com', true],
  [unverified, 'unverified@example.com', false]
] as const) {
  await db.query(
    'insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values ($1,$2,case when $3 then now() else null end,$4)',
    [id, email, verified, { display_name: email, is_admin: true }]
  )
}
await db.query('insert into printer_private.admin_memberships(user_id) values ($1)', [owner])
const asUser = async (id: string): Promise<void> => {
  await db.exec('reset role')
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec('set role authenticated')
}
const rpcAction = async (
  action: string,
  userId: string,
  requestId: string | null = null,
  days = 14,
  plan = 'shop'
) =>
  db.query('select public.printer_admin_action($1,$2,$3,$4,$5,$6)', [
    action,
    userId,
    requestId,
    plan,
    days,
    'Owner decision'
  ])
try {
  await db.exec('set role anon')
  await assert.rejects(
    () => db.query('select public.printer_access_snapshot()'),
    /permission denied/
  )
  await assert.rejects(
    () => db.query('select * from public.printer_access_grants'),
    /permission denied/
  )
  await asUser(unverified)
  await assert.rejects(
    () => db.query('select public.printer_access_snapshot()'),
    /Verified account required/
  )
  await assert.rejects(
    () => db.query("select public.printer_submit_request('Shop', '', 'shop')"),
    /Verified account required/
  )

  await asUser(alice)
  const result = await db.query<{ printer_access_snapshot: { is_admin: boolean; grant: unknown } }>(
    'select public.printer_access_snapshot()'
  )
  assert.equal(
    result.rows[0].printer_access_snapshot.is_admin,
    false,
    'editable metadata must never grant owner access'
  )
  assert.equal(result.rows[0].printer_access_snapshot.grant, null, 'signup must not grant a trial')
  assert.equal((await db.query('select * from public.printer_profiles')).rows.length, 1)
  await assert.rejects(
    () => db.query('select * from printer_private.admin_memberships'),
    /permission denied/
  )
  await assert.rejects(
    () => db.query('select public.printer_admin_list()'),
    /Owner access required/
  )
  await assert.rejects(() => rpcAction('grant', alice), /Owner access required/)
  await assert.rejects(
    () =>
      db.query(
        "insert into public.printer_access_grants values ($1, 'shop', 'active', now(), now() + interval '30 days', '')",
        [alice]
      ),
    /row-level security/
  )
  await assert.rejects(
    () =>
      db.query(
        "insert into public.printer_access_requests(user_id,shop_name,message,requested_plan,status) values ($1, 'Shop', '', 'shop', 'approved')",
        [alice]
      ),
    /permission denied/
  )
  await assert.rejects(
    () =>
      db.query(
        "insert into public.printer_access_requests(user_id,shop_name,message,requested_plan) values ($1, 'Shop', '', 'shop')",
        [bob]
      ),
    /row-level security/
  )
  await db.query(
    "select public.printer_submit_request('Alice Shop', 'Please give a trial', 'shop')"
  )
  await assert.rejects(
    () => db.query("select public.printer_submit_request('Alice Shop', '', 'shop')"),
    /wait a minute|pending request/
  )
  const request = (await db.query<{ id: string }>('select id from public.printer_access_requests'))
    .rows[0].id
  assert.equal(
    (await db.query("update public.printer_access_requests set status='approved' returning id"))
      .rows.length,
    0
  )
  await asUser(bob)
  assert.equal(
    (await db.query('select * from public.printer_access_requests')).rows.length,
    0,
    'customer cannot read another request'
  )
  await asUser(owner)
  await assert.rejects(
    () => rpcAction('approve', bob, request),
    /already been reviewed|does not exist/
  )
  await assert.rejects(() => rpcAction('trial', alice, null, 0), /Invalid plan/)
  await rpcAction('trial', alice)
  await asUser(alice)
  const trial = (
    await db.query<{ status: string; ends_at: string; starts_at: string }>(
      'select * from public.printer_access_grants'
    )
  ).rows[0]
  assert.equal(trial.status, 'trial')
  assert.equal(
    Math.round((Date.parse(trial.ends_at) - Date.parse(trial.starts_at)) / 86_400_000),
    14
  )
  assert.equal(
    (await db.query<{ status: string }>('select status from public.printer_access_requests'))
      .rows[0].status,
    'approved'
  )
  assert.equal(
    (
      await db.query(
        "update public.printer_access_grants set ends_at=now() + interval '100 years' returning user_id"
      )
    ).rows.length,
    0
  )
  await asUser(owner)
  await assert.rejects(() => rpcAction('approve', alice, request), /already been reviewed/)
  await rpcAction('extend', alice, null, 7)
  const extended = (
    await db.query<{ ends_at: string; status: string }>(
      'select ends_at,status from public.printer_access_grants where user_id=$1',
      [alice]
    )
  ).rows[0]
  assert.equal(extended.status, 'trial')
  assert.equal(
    Math.round((Date.parse(extended.ends_at) - Date.parse(trial.ends_at)) / 86_400_000),
    7
  )
  await rpcAction('revoke', alice)
  await assert.rejects(() => rpcAction('extend', alice), /reinstate/)
  await asUser(alice)
  assert.equal(
    (
      await db.query<{ printer_access_snapshot: { grant: { status: string } } }>(
        'select public.printer_access_snapshot()'
      )
    ).rows[0].printer_access_snapshot.grant.status,
    'revoked'
  )
  await asUser(owner)
  await rpcAction('grant', alice, null, 30, 'pro')
  await asUser(bob)
  await db.query("select public.printer_submit_request('Bob Shop', '', 'pro')")
  const bobRequest = (
    await db.query<{ id: string }>('select id from public.printer_access_requests')
  ).rows[0].id
  await asUser(owner)
  await rpcAction('deny', bob, bobRequest)
  assert.equal(
    (await db.query('select * from public.printer_access_grants where user_id=$1', [bob])).rows
      .length,
    0
  )
  const audit = await db.query('select * from public.printer_access_audit')
  assert.ok(audit.rows.length >= 6, 'all owner mutations must produce audit records')
  await assert.rejects(
    () => db.query('delete from public.printer_access_audit'),
    /permission denied/
  )
  await asUser(alice)
  assert.equal((await db.query('select * from public.printer_access_audit')).rows.length, 0)
  await db.exec('reset role')
  const exposed = await db.query<{ proname: string; prosecdef: boolean }>(
    "select proname,prosecdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like 'printer_%'"
  )
  assert.ok(
    exposed.rows.every((row) => !row.prosecdef),
    'public RPCs must enforce caller RLS'
  )
  console.log(
    'Access database verified: auth isolation, RLS, owner actions, trial/extension, revocation/reinstatement, duplicate review, denial and immutable audit.'
  )
} finally {
  await db.close()
}
