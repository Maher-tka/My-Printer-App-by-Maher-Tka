# Free account and access setup

The app now includes hosted email/password and Google login, access requests, and
an owner screen for approval, denial, trials, extension, revocation, and reinstatement.
There is no payment integration. Printing and exporting require server-verified
access. A Supabase backend must be provisioned before customer accounts work.

## Supabase project

Create one Supabase Free project for this app. Its free quotas and inactivity
pausing policy still apply. Keep all print projects/artwork local; only account and
access metadata is stored in Supabase. Restore paused projects from Supabase Studio.

Apply `supabase/migrations/20261002054818_printer_access.sql` once to the project
using the Supabase migration workflow or SQL editor. The migration creates tables,
private owner-role checks, RLS policies, transactional RPCs, and immutable audit
triggers. It does not automatically make the first registered customer an owner.
Do not add `printer_private` to the Data API's exposed schemas.

Copy `.env.example` to `.env.local` and fill in the project URL and **publishable**
key from Supabase Settings. These public connection settings are embedded in the
Electron main build, so configure them before building a release. Never use a
secret/service-role key. Restart the development process after changing settings.

Use `npm run dev` for development. The existing `.env.development` unlocks tools
for testing; put `VITE_DEV_UNLOCK_ALL=false` in `.env.local` when testing actual
access restrictions. Packaged builds cannot use the development unlock. Without
valid connection settings the packaged app fails closed with a setup message.

Old local account/license files are retained but do not grant online access.
`PRINTER_ACCOUNT_MODE=local-test` explicitly selects the old account system in
non-packaged tests only. Agree any legacy-license exchange with customers before
distributing the online version.

## Google sign-in

Enable Google in Supabase Auth and configure its Google Cloud client ID/secret.
Register the Supabase callback URL shown in the Google provider settings with
Google. Keep the Google client secret in Supabase, never the desktop bundle.

Allow this desktop redirect pattern in Supabase Auth URL Configuration:

```text
http://127.0.0.1:43821/auth/callback**
```

The app opens the system browser, uses PKCE plus a random desktop callback nonce,
and exchanges the returned code in Electron main. Port 43821 must be available.
Confirm the redirect pattern in both development and the packaged Windows app.

## Email accounts (optional when starting with Google)

For a controlled workshop pilot before configuring email delivery, create verified
owner/tester accounts in Supabase Studio under **Authentication → Users → Add user →
Create new user**. The account holder should choose and enter the password. Assign
the verified owner's private membership below, then approve tester access from the
app. Public signup and password recovery remain unavailable until email delivery is
configured. The free dashboard currently requires custom SMTP to edit email templates.

Public email signup requires an SMTP sender. Supabase's default sender only sends
to project-team addresses and is unsuitable for customers. Choose a sender within
its free allowance and verify its sender/domain requirements. Google sign-in can
be enabled first if zero-cost public email delivery is not configured yet.

Keep Confirm email enabled. In Supabase Auth email templates, include the token
in both **Confirm signup** and **Reset password** messages:

```html
<p>Your My Printer App code is: {{ .Token }}</p>
```

Customers enter this code in the app under **Verify email with a code** or
**Forgot password?**. This avoids needing a separately hosted confirmation page.
Use the built-in provider identity-linking rules; do not merge accounts from a
client-supplied email string. Check your SMTP delivery limits before inviting users.

## Make Maher the owner

First sign in normally so the account has a verified email. In the Supabase SQL
editor, look up its immutable user id by the exact owner email:

```sql
select id, email, email_confirmed_at from auth.users
where lower(email) = lower('REPLACE_WITH_OWNER_EMAIL');
```

After checking that the row is Maher's verified account, add that user id:

```sql
insert into printer_private.admin_memberships(user_id)
values ('REPLACE_WITH_VERIFIED_OWNER_UUID')
on conflict do nothing;
```

Refresh **Account access** in the app. Owner permissions come from this private
table, not profile metadata. Customers cannot insert or edit owner memberships.

## Day-to-day use

For plan tool lists and individual subscription settings, see [Subscription controls](SUBSCRIPTION_CONTROLS.md).

Customers sign up, submit a shop name/plan/message, and wait for review. Signup
does not start a trial automatically. Only one pending request per account is
allowed. Customers can read only their own request and access records.

Maher opens **Account access** to review the inbox and all accounts:

- Approve chooses Pro/Shop and a duration in days.
- Give trial grants a chosen duration (14 days by default) and resolves any pending request.
- Deny resolves only that request; it does not revoke an existing grant.
- Grant / reinstate explicitly grants a new period and can restore revoked access.
- Extend adds days to the later of the existing end date and server time, preserving the existing plan and trial/active status.
- Revoke blocks new prints/exports; it does not delete projects or refund payments.

The owner screen shows up to 1,000 records per list and warns when truncated.
Use Supabase Studio for larger datasets until pagination is added.

## Connection and access limits

This pilot requires internet access. It does not issue signed offline licenses.
The account view refreshes every minute and on focus/reconnection; display access
expires after 90 seconds without a fresh response. Every protected native action
checks the backend again. A disconnected/paused backend blocks new production
output. Existing workspace/project state stays open so customers can save their
project. Native print jobs already submitted cannot be recalled by revocation.

Windows safeStorage protects auth sessions on disk. No tokens or passwords are
sent to the renderer, and the app refuses plaintext session persistence.
The user can sign out even if the backend is unavailable.

No free-plan uptime guarantee is assumed. Make manual database backups since
automatic backups are not included. No automation is added to manufacture activity
or bypass Supabase's inactivity policy.

## Verification

Run `npm run test:access` for real Postgres-compatible RLS/permission and owner-flow
tests using an isolated PGlite database, plus server-time/expiry/plan checks.
Run `npm run typecheck` and `npm run build` after setting project connection values.
Storybook includes design previews under **Account/Online access**, using isolated
sample records that cannot send live requests or owner decisions.

Before distributing: test real Google sign-in and cancellation; email code delivery
and recovery if enabled; a separate customer account's request; owner trial/denial;
expiry, revocation, extension and reinstatement; unauthorized REST/RPC writes;
app restart/session persistence; signing out; and output restrictions in the packaged
Windows app. Run Supabase security advisors against the deployed schema.

Sources: [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google),
[email delivery](https://supabase.com/docs/guides/auth/auth-smtp),
[free limits](https://supabase.com/pricing),
[row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
