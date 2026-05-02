<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:emr-mvp-agent-rules -->
# EMR MVP working context

Before starting repository work, read `docs/implementation/mvp-current-status.md` first. Treat it as the current source of truth for MVP scope, completed PRs, mock/no-op boundaries, preserved screens, and the recommended next work.

For screen work, also check `docs/implementation/reference-screen-index.md` and confirm whether the referenced image files actually exist under `docs/assets/reference-screens/`. If binary reference images are missing, do not claim pixel-level alignment.

Preserve the current 조제/처치 screen design and behavior unless the user explicitly asks to change it. 입원 and full 병원관리 screens are outside the completed PR 1-6 scope, and 병원관리 Order 관리 / Order 세트 references are not implementation targets unless a new plan explicitly includes them.
<!-- END:emr-mvp-agent-rules -->
