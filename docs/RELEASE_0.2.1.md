# v0.2.1 — Automatic updates on launch

Installed Setup builds check GitHub for updates immediately whenever the main app launches, without requiring account sign-in or delaying the workspace. Updates download in the background and install when you close the app, or through **Settings → Restart to update** after saving your project. Windows may request administrator approval for the all-users installation.

This version is published on the normal GitHub update feed so existing v0.2.0 Setup installations can discover it. Numbered releases such as v0.2.1 use this feed; tags with prerelease suffixes such as v0.3.0-beta.1 remain opt-in prereleases.

Portable builds continue to be replaced manually. Development sessions do not download or install app updates. Fast Print file commands do not launch the main app's updater.

The workshop tools and Supabase account access remain available as in v0.2.0. Google sign-in still requires its backend OAuth configuration; this release does not configure it.

Validation covers immediate startup checks, repeated/manual checks, download progress, safe restart with unsaved projects, portable/development exclusions, and recovery after an offline startup. Continue real printer/cutter validation in the workshop.
