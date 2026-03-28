<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Collaboration Preference

- 시각 자료나 브라우저 프리뷰가 도움이 될 것 같아도 visual companion 사용 여부를 묻는 확인 질문을 따로 하지 말고 바로 진행한다.
- 이 저장소에서는 브라우저 기반 설명, 목업, HTML 프리뷰, 다이어그램이 기본 허용된 것으로 간주한다.
- 사용자가 명시적으로 텍스트만 원한다고 말한 경우에만 브라우저/시각 프리뷰를 생략한다.

## Eagle Thumbnail Ops

When the user asks to process uncategorized Eagle thumbnails, treat it as the animated thumbnail workflow for the Eagle library.

- Use `node scripts/eagle-thumbnail-pilot.mjs --remaining` for the full remaining batch.
- Use `node scripts/eagle-thumbnail-pilot.mjs` only for the fixed 10-item pilot.
- The thumbnail preset is Med: `480w`, `15fps`, `q65`.
- The script replaces static `_thumbnail.png` files with animated WebP content while keeping the `_thumbnail.png` filename.
- Backups are written to `.tmp/eagle-thumbnail-backups/<timestamp>/`.
- Delete backups only after the user explicitly confirms the thumbnails look correct in Eagle.

## Eagle Phase 2 Ops

- Use `npm run eagle:phase2:review` to generate name review artifacts for uncategorized mp4 items.
- Review and edit the generated `name-review.json`, marking approved entries with `"approved": true`.
- Use `npm run eagle:phase2:apply -- --review-file <absolute-path>` to apply approved renames, tag sync, and folder assignment.
- Tags exclude numeric-only tokens such as `2`, `3`, `(2)`.
- Folder writes use only folder IDs explicitly listed in `scripts/config/eagle-phase2-folder-rules.json`.
