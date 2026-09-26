# Offline license keys

The app verifies serial keys with an embedded Ed25519 public key. The matching
private key stays only on the seller machine and is ignored by Git.

1. Run `npm run license:keygen` once on the seller machine.
2. Back up `.license-private/license-signing-private.pem` securely. Do not commit
   or share it.
3. Commit the generated `src/main/license-public-key.ts`, then build the app.
4. Create customer keys with `npm run license:generate` or its existing flags.

Set `MPTK_LICENSE_PRIVATE_KEY_FILE` to keep the private key at another local
path. Key generation refuses to replace an existing private key; `--force`
rotates the key pair and invalidates every serial issued with the previous key.

The hardened verifier intentionally rejects the pre-release HMAC serial format.
Version 2 local activation records are backed up and require activation with a
new Ed25519 serial because their former shared secrets were public.

## Account access

The desktop app now starts behind an access screen:

- New users create a local account to start the 14-day trial.
- Returning users sign in with the account stored on that computer.
- Customers with a Pro or Shop subscription key can use the Subscription tab
  and open the app without creating a local account.

Account credentials are stored in the Electron user-data directory. This is a
device-local access layer; online accounts, password recovery, and recurring
checkout still require a hosted authentication and billing service before a
public SaaS-style release.
