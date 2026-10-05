# Subscription controls

Open **Account access** while signed in as an owner.

- **Subscription plans and tools** configures the tool list and batch exports separately for Pro and Shop. Trials use the plan selected when granting the trial. Plan changes affect existing and future customers who follow that plan.
- **Manage subscription** changes a customer's plan without changing their start date, expiry, or trial/active/revoked status. Select **Follow selected plan** or a **Custom tools for this customer** list. Batch exports can independently follow the plan, be included, or be excluded.
- An empty custom tool list removes every production tool. Switching back to **Follow selected plan** restores inheritance. Custom lists remain unchanged when plan defaults change.
- **Revoke** disables the whole subscription while preserving its dates, plan and custom settings. **Grant / reinstate** explicitly starts a new active period. Managing a revoked subscription never reinstates it.
- Search accounts by name or email. The account table shows inherited/custom tools and batch access. Subscribers can see their included tools on their own Account access page.

Printing, file exports, Cutter/Illustrator output and Explorer Fast Print perform a fresh online check in Electron main. Restricted native exports require a tool identity; the preload tracks the active tool even when it has no saved project. Existing open work remains available for saving as a project when access changes, while production output is denied. Opening a different excluded tool shows the access screen.

The display refreshes every minute and on reconnection/focus; cached access expires after 90 seconds. Work already sent to a printer cannot be recalled.

Apply `supabase/migrations/20261004114816_subscription_controls.sql` after the base access migration. It preserves existing permissions by initially including all six current tools in both plans, with batch exports enabled for Shop. Owner-only RPCs and RLS protect changes, whitelist valid tool identifiers, and audit both plan and customer mutations. Owner accounts retain all tools.

Per-tool enforcement requires this updated desktop build. Older installed versions only understand whole-account access/revocation. Publish a stable desktop release before relying on tool restrictions for subscribers using older versions. Development mode intentionally unlocks all tools; test real restrictions with `VITE_DEV_UNLOCK_ALL=false` in `.env.local` or a packaged build.

Validation: `npm run test:access` covers plan inheritance, custom overrides, resetting to plan defaults, empty lists, invalid identifiers, unauthorized changes, expiry preservation, revocation and immutable audits. `npm run test:print` verifies the print request contract.
