# v0.2.5 — Correct registration checks for masked stickers

Production preflight now checks registration marks against each sticker's freshly calculated production bounds, including its clipping mask and cutline offset. It no longer treats the unused area of the original image frame as printed sticker artwork.

This fixes the false registration-overlap warning reproduced with the workshop's half-metre order: 72 masked stickers arranged on a 92.5 × 50 cm production page. Artwork dimensions, copy count, requested material length, registration-mark positions, and saved projects remain unchanged.

Genuine registration collisions still raise a warning, including when a saved placement has a stale cached footprint. Invalid production geometry remains a blocking error.

Installed Setup builds receive this stable release through automatic updates. Apply the downloaded update and reopen the project before exporting. Portable builds must be replaced manually.

Validation includes the workshop geometry regression, a real-collision/stale-cache regression, the complete release checks, and the Windows package workflow. Physical printer/cutter testing remains part of workshop acceptance.
