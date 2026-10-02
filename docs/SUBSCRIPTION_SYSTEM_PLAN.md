# Free launch: accounts and owner-managed access

Status: free pilot implemented in the app and migration; live project setup and
provider verification remain. See [FREE_ACCESS_SETUP.md](FREE_ACCESS_SETUP.md).
Prepared on 2026-10-02 after inspecting the existing account and licensing code.
Updated on 2026-10-02: start free; all payment features are deferred.

## Confirmed requirements

- Customers sign up with email/password or Google.
- Start within free service quotas, without checkout or payment integration.
- Customers submit an access request after signup.
- Maher receives requests in an owner dashboard and can approve or deny them.
- Maher can grant a trial, extend access, or revoke access.

## Recommended services

Use Supabase Auth for accounts and a Supabase Postgres database for requests,
subscriptions, devices, and audit history. Use server functions for privileged
actions. Put an owner-only management screen in the desktop app for the first
version, avoiding separate dashboard hosting. Enforce owner permissions on the
backend; hiding the screen alone is not authorization.

Supabase Free currently includes 50,000 monthly active users, 500 MB database,
5 GB egress, and social OAuth providers. Keep printer projects and artwork local;
sync only account/access metadata. Free projects pause after a week of inactivity,
and automatic database backups are not included. Use manual backups and a useful
retry state if the backend is unavailable. This is a free pilot within quotas.

Google sign-in can avoid confirmation-email delivery. Public email/password signup
and password reset need external SMTP: Supabase's default sender only delivers to
pre-authorized project-team addresses. Select a sender within its free allowance
and confirm sender verification requirements before promising public email signup
at zero cost. Keep email verification enabled. Access requests appear in the owner
screen; email alerts can wait.

## Payments: future phase only

Use Konnect hosted checkout for Tunisian payments, subject to merchant onboarding.
Konnect documents Tunisian and international cards and e-DINAR. Its payment API
creates a checkout URL and provides payment notifications and payment lookup.
The future payment design sells a fixed access period per verified payment; customers
renew through another checkout. Automatic recurring debits are a separate feature
and must not be promised until Konnect confirms support for this merchant.

## Customer flow

1. Create an account and verify the email, or continue with Google.
2. Show an access page with Request access and current access status.
3. Request access: submit shop name, requested plan, contact details, and a message.
   Show Pending review until Maher decides. Limit duplicate pending requests.
4. Maher approves access, denies the request, or grants a trial for a chosen duration.
5. Refresh access after approval or trial grant. Show the expiry date and a request
   extension action. Login alone does not grant licensed tool access.
6. When denied, expired, or revoked, keep account, request history, and saved work
   available. Preserve unsaved work and gate new paid actions rather than force-close
   the app during a production task.

Google sign-in should use the system browser and PKCE. Design and test an
allow-listed desktop callback and single-instance handling. Store session tokens
in Electron main using OS-protected storage; never collect a Google password.
Email/password and Google identities should link through verified identity flows,
never through a client-provided email string.

## Owner dashboard

| Action                  | Result                                                                          |
| ----------------------- | ------------------------------------------------------------------------------- |
| Review requests         | List pending requests, shop details, message, and submission date               |
| Approve                 | Choose plan and end date, then grant access and resolve the request             |
| Deny                    | Resolve that request with a reason; existing access remains a separate decision |
| Grant trial             | Choose duration and allowed features, for example 7, 14, or 30 days             |
| Extend or change access | Change the access period or plan and record the reason                          |
| Revoke                  | Block access and new offline grants until explicitly reinstated                 |
| Reinstate               | Explicitly remove the block and select the access to restore                    |

Every decision records the owner, customer, timestamp, reason, and before/after
values. Requests appear in a persistent dashboard inbox. Optional email alerts
should use a server-side outbox with retries and deduplication; the inbox remains
the authoritative record even if notification delivery fails.

## Data and authorization

Keep identity, request decisions, and access rights separate:

- `profiles`: authenticated customer and shop/contact information.
- `access_requests`: pending/approved/denied decision, requested plan, and review details.
- `access_grants`: trial/manual source at launch, plan, start/end dates, and revocation.
- `account_access_blocks`: owner-imposed account block; takes priority over all grants.
- `devices`: account-bound installations and activation/last-check information.
- `admin_memberships`: owner-controlled roles, outside customer-editable profile data.
- `audit_log`: append-only owner decisions.

Payment orders/events and the notification outbox are future-phase tables.

Customers may read their own access/payment status and submit their own requests.
They cannot change plans, expiry, payment status, admin roles, or approval decisions.
Enable row-level security on all exposed tables. Privileged actions check the
current owner membership on the backend. Provider keys, Google client secrets,
Supabase secret keys, and the access-signing private key stay on the server.

Use server UTC timestamps for access decisions. Resolve effective access by first
checking account blocks, then unrevoked grants whose dates include the current time.
A denied request does not revoke another grant. A verified payment for a blocked
account remains recorded but requires owner resolution; a delayed payment callback
must never silently remove an owner block. Revocation does not automatically refund
an existing payment or cancel any future billing agreement.

## Payment processing (deferred)

The backend creates an order and initiates checkout using the price catalog it
controls. The desktop submits a plan identifier, never the authoritative price.
Store the provider reference before redirecting to checkout.

Treat notification callbacks as a signal to fetch payment details from Konnect.
Verify completed status, expected amount, currency, recipient wallet, and reference
against the stored order before granting access. A checkout return URL or payment
screenshot cannot activate a subscription. Process callbacks transactionally and
idempotently so duplicate callbacks cannot grant duplicate periods. Handle delayed
payments, partial payments, failures, refunds, and provider reconciliation explicitly.

For an early renewal of the same plan, extend from the later of the existing paid
end date and server time. Trial conversion, plan changes, and refund behavior need
explicit rules before launch. Keep any refund policy separate from access controls.

## Offline work and revocation

Future offline design only (not implemented in the free pilot): check online on launch, reconnection, and every
5 minutes while connected. Issue a signed offline access grant valid for at most
24 hours, capped by the subscription/trial expiry. Bind it to account and device.
Cache it in Electron main and validate its signature and dates there before paid
operations. This limits offline revocation delay to the remaining grant lifetime
in the intended client; a disconnected device cannot receive instant revocation.

Never accept an old cache after receiving an authoritative revoked/blocked response.
Keep a local block marker and reject clock rollback. Sign-out clears account-bound
cached access. No cache plus no network means access is unavailable, with a useful
retry message. Test both offline expiry and backend outages.

Do not continue allowing unrestricted legacy lifetime serials to unlock subscriptions
that the owner expects to revoke remotely. Choose a migration policy: explicitly
retain them as separate offline licenses, or exchange validated customer licenses
for account-bound grants. Never infer eligibility from local passwords or files.

## Existing code to change

| File                                             | Work                                                                                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `src/main/account.ts`                            | Replace device-only accounts with hosted authentication and protected sessions       |
| `src/shared/account-types.ts`                    | Add hosted identity, verification, and auth-flow state                               |
| `src/renderer/src/account/AccountAccessPage.tsx` | Add Google sign-in, verification, password reset, and access status                  |
| `src/main/licensing.ts`                          | Fetch server access, verify signed offline grants, and enforce paid-operation access |
| `src/shared/licensing-types.ts`                  | Represent pending, trial, active, expired, and revoked access with server dates      |
| `src/preload/index.ts`                           | Expose narrowly scoped auth, request, owner-action, and access-refresh IPC methods   |
| `src/renderer/src/account/useAccountState.ts`    | Handle hosted session lifecycle and callback results                                 |
| `src/renderer/src/licensing/useLicenseState.ts`  | Refresh remote access and display offline/expiry state                               |
| `src/renderer/src/app/App.tsx`                   | Replace local serial/sign-in gating with effective account access                    |

The current trial starts when the local license record is initialized, rather than
being an owner-granted server trial. Move trial creation and expiry to the backend.
Preserve the explicit development/test workflow and ensure packaged builds cannot
use development unlocks. Identify every paid print/export entry point, including
Fast Print, and enforce access in Electron main where the privileged action runs.

## Delivery sequence and launch checks

1. Set up Supabase Free auth, database rules, owner role, and access plans.
2. Implement request submission, owner inbox, approval/denial, trial grants, and audit.
3. Connect desktop sign-in, access status, licensed-action gates, and offline grants.
4. Add the owner screen, deploy the backend within free quotas, configure Google
   OAuth and public-signup SMTP, and test the packaged Windows app.
5. Later, integrate Konnect checkout, verified callbacks, reconciliation, and renewals.

Required checks: verified email and Google callback; identity linking; customer
attempts to edit another account or grant themselves access; concurrent owner
decisions; online and offline trial/access expiry;
token refresh; clock rollback; device limits; preserving work during loss of access;
and development unlocks excluded from the packaged production build.

Future payment checks: duplicate/wrong-amount/partial/delayed callbacks; renewal
exactly once; revocation during checkout; refund reconciliation.

Before production configuration, specify access durations, device
limits, whether trials are owner-granted only, the owner account, offline tolerance,
legacy-license treatment, and extension rules. A live launch also requires a
Supabase Free project, Google OAuth configuration, a suitable SMTP sender for public
email signup, and deployed HTTPS backend endpoints. Konnect and TND prices are only
needed in the later payment phase. Share secret credentials through
provider settings or a secret manager, not chat or committed files.

## Sources checked

- [Supabase Free pricing and limits](https://supabase.com/pricing)
- [Supabase email delivery requirements](https://supabase.com/docs/guides/auth/auth-smtp)
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Konnect payment API](https://pay.konnect.network/en/services/api-info/)
- [Konnect payment initiation](https://docs.konnect.network/docs/fr/api-integration/endpoints/initiate-payment)
- [Konnect payment verification](https://docs.konnect.network/docs/en/api-integration/endpoints/get-payment-details)
- [Konnect payment flow](https://docs.konnect.network/docs/en/api-integration/intro)
