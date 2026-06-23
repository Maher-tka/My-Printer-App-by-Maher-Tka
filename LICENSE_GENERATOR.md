# Offline License Generator

The seller-side generator creates Pro and Shop serial keys locally. It uses the
same signing and validation code as the desktop app and makes no network calls.

## Interactive use

From the repository folder, run:

```powershell
npm run license:generate
```

Choose `Pro` or `Shop`, then enter `Lifetime` or an expiry date in
`YYYY-MM-DD` format. Leave the seat code blank to generate a random code.

## One-command use

```powershell
npm run license:generate -- --plan pro --expiry lifetime
npm run license:generate -- --plan shop --expiry 2027-12-31 --seat SHOP01
```

Use `--plain` to print only the key or `--json` for structured output. Run
`npm run license:generate -- --help` for every option.

## Activate a generated key

Open **License** in My Printer App, paste the generated key into **Serial Key**,
and choose **Activate Locally**. The page should show the selected plan, seat,
and either `Lifetime` or the chosen expiry date.

Keep this repository and its signing source private. The generator is a seller
tool and is intentionally not exposed through the customer-facing Electron UI.
