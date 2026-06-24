# Local job system

My Printer App uses local `.mpjob` project files and an Electron-managed recent-project index. Booklet, Cutter, and Hardcover projects all use the same versioned envelope and reopen through native desktop file dialogs.

Each saved Hardcover job stores customer/phone/title, production status, notes, quote inputs, cover setup/content/template, batch students, and export settings. The dashboard reads real saved project paths; missing files are marked instead of replaced with demo rows.

Batch folder exports use this structure below the folder selected by the operator:

```text
Orders-style job folder/
  source/
  project/
  export/
  preview/
  invoice/
```

Folder names remove invalid path characters and normalize accents. Version helpers generate names such as `cover_v01.pdf`. Batch covers use `001_StudentName_Cover.pdf`.

The quick quote foundation records material, printing, finishing/binding, design, quantity, discount, deposit, final price, and remaining balance. It is production metadata, not accounting or invoicing software yet.

Everything is local-first: no cloud account or database is required. Back up `.mpjob` files and the chosen Orders folder as part of the shop backup routine.
