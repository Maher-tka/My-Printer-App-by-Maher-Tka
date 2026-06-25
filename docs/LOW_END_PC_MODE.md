# Low-end PC mode

Low-end PC mode is recommended for old printer-shop computers.

Enable it in **Settings → Performance → Low-end PC**. The preference stays on the machine.

The mode currently:

- limits preview render concurrency to one;
- imports PDFs in smaller batches;
- reduces thumbnail and preview dimensions/JPEG quality;
- lowers canvas and object-URL memory budgets;
- disables heavy transitions and reduces shadows;
- requires manual 3D booklet preview loading for large projects;
- uses a simplified cutter artwork block while dragging;
- renders the hardcover mockup only on demand;
- keeps progress feedback visible during PDF import and export.

It does not reduce physical print dimensions. Final exports still use the project millimeter settings. For very large PDFs, close other applications, keep the project on a local disk, and export one job at a time.

If an out-of-memory warning appears, save the project, switch to Low-end PC, restart the app, and retry. Export a diagnostic report from **App Health** if the failure repeats.
