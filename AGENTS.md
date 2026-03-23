<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Eagle Thumbnail Ops

When the user asks to process uncategorized Eagle thumbnails, treat it as the animated thumbnail workflow for the Eagle library.

- Use `node scripts/eagle-thumbnail-pilot.mjs --remaining` for the full remaining batch.
- Use `node scripts/eagle-thumbnail-pilot.mjs` only for the fixed 10-item pilot.
- The thumbnail preset is Med: `480w`, `15fps`, `q65`.
- The script replaces static `_thumbnail.png` files with animated WebP content while keeping the `_thumbnail.png` filename.
- Backups are written to `.tmp/eagle-thumbnail-backups/<timestamp>/`.
- Delete backups only after the user explicitly confirms the thumbnails look correct in Eagle.
