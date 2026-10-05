import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const owner = '00000000-0000-0000-0000-000000000001'
const alice = '00000000-0000-0000-0000-000000000002'
const bob = '00000000-0000-0000-0000-000000000003'
const unverified = '00000000-0000-0000-0000-000000000004'
const migrationDirectory = new URL('../supabase/migrations/', import.meta.url)
await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, email_confirmed_at timestamptz, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`)
for (const file of (await readdir(migrationDirectory))
  .filter((name) => name.endsWith('.sql'))
  .sort()) {
  await db.exec(await readFile(new URL(file, migrationDirectory), 'utf8'))
}
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
        "insert into public.printer_access_grants(user_id,plan,status,starts_at,ends_at,reason) values ($1, 'shop', 'active', now(), now() + interval '30 days', '')",
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
  const accessSnapshot = async () =>
    (
      await db.query<{
        printer_access_snapshot: {
          allowed_tools: string[]
          batch_exports: boolean
          grant: { plan: string; status: string; starts_at: string; ends_at: string }
        }
      }>('select public.printer_access_snapshot()')
    ).rows[0].printer_access_snapshot
  const changePlan = (plan: string, tools: (string | null)[] | null, batch: boolean | null) =>
    db.query('select public.printer_admin_plan($1,$2,$3)', [plan, tools, batch])
  const manage = (tools: (string | null)[] | null, batch: boolean | null, plan = 'pro') =>
    db.query('select public.printer_admin_subscription($1,$2,$3,$4,$5)', [
      alice,
      plan,
      tools,
      batch,
      'Custom subscription'
    ])

  await changePlan('pro', ['booklet-montage'], false)
  await asUser(alice)
  const beforeManage = await accessSnapshot()
  assert.deepEqual(beforeManage.allowed_tools, ['booklet-montage'])
  assert.equal(beforeManage.batch_exports, false)
  await assert.rejects(() => changePlan('pro', [], true), /Owner access required/)
  await assert.rejects(() => manage(['cutter-montage'], true), /Owner access required/)
  assert.equal(
    (await db.query("update public.printer_subscription_plans set tool_ids='{}' returning plan"))
      .rows.length,
    0
  )
  assert.equal(
    (
      await db.query(
        "update public.printer_access_grants set tool_ids=array['cutter-montage'] returning user_id"
      )
    ).rows.length,
    0
  )
  await asUser(owner)
  await assert.rejects(() => changePlan('pro', ['unknown-tool'], false), /Invalid subscription/)
  await assert.rejects(() => changePlan('pro', [null], false), /Invalid subscription/)
  await assert.rejects(() => changePlan('pro', null, false), /Invalid subscription/)
  await assert.rejects(() => changePlan('trial', [], false), /Invalid subscription/)
  await assert.rejects(() => manage(['unknown-tool'], false), /Invalid subscription/)
  await manage(['cutter-montage'], true)
  await changePlan('pro', ['sequential-number'], false)
  await asUser(alice)
  const custom = await accessSnapshot()
  assert.deepEqual(custom.allowed_tools, ['cutter-montage'], 'custom lists survive plan changes')
  assert.equal(custom.batch_exports, true, 'batch permission can be granted individually')
  assert.equal(custom.grant.starts_at, beforeManage.grant.starts_at)
  assert.equal(
    custom.grant.ends_at,
    beforeManage.grant.ends_at,
    'management must not extend expiry'
  )
  await asUser(owner)
  await manage([], false, 'shop')
  await asUser(alice)
  const noTools = await accessSnapshot()
  assert.deepEqual(noTools.allowed_tools, [], 'empty custom list must deny all tools')
  assert.equal(noTools.grant.plan, 'shop')
  assert.equal(noTools.batch_exports, false, 'Shop batch exports can be disabled')
  await asUser(owner)
  await manage(null, null, 'pro')
  await asUser(alice)
  assert.deepEqual(
    (await accessSnapshot()).allowed_tools,
    ['sequential-number'],
    'null restores plan inheritance'
  )
  await asUser(owner)
  await rpcAction('revoke', alice)
  await manage(['booklet-montage'], true)
  await asUser(alice)
  const revoked = await accessSnapshot()
  assert.equal(revoked.grant.status, 'revoked', 'editing tools cannot reinstate revoked access')
  assert.equal(revoked.grant.ends_at, beforeManage.grant.ends_at, 'revocation must preserve expiry')
  assert.equal(revoked.grant.starts_at, beforeManage.grant.starts_at)
  await asUser(owner)
  const plansInList = (
    await db.query<{ printer_admin_list: { plans: unknown[] } }>(
      'select public.printer_admin_list()'
    )
  ).rows[0].printer_admin_list.plans
  assert.equal(plansInList.length, 2)
  const audit = await db.query('select * from public.printer_access_audit')
  assert.ok(audit.rows.length >= 13, 'all owner mutations must produce audit records')
  assert.equal(
    (
      await db.query(
        "select * from public.printer_access_audit where action='subscription_plan:update'"
      )
    ).rows.length,
    2,
    'both plan changes must be audited'
  )
  assert.equal(
    (
      await db.query(
        "select * from public.printer_access_audit where details->'after'->>'reason'='Custom subscription'"
      )
    ).rows.length,
    4,
    'all customer subscription edits must be audited'
  )
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
    'Access database verified: auth isolation, RLS, owner actions, trial/extension, revocation/reinstatement, duplicate review, denial, plan inheritance, customer tool overrides and immutable audit.'
  )
} finally {
  await db.close()
}
