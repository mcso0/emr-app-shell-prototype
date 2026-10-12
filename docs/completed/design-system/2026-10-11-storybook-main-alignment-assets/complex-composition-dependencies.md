# Deferred full-composition dependencies

These remain concrete source-only rows. Batch 2 adds pure feature presentation and a narrowly intercepted read-only preconsultation panel; it does not fabricate a full shell or result-sheet harness.

## Lab result phase 2

- `src/features/lab-imaging/components/lab-result-phase2.tsx:79` owns attachment card/list mode, selection, deletion confirmation, upload queue/progress/cancel/retry and preview continuity. Existing `LabAttachmentViewer` stories cover a viewer only.
- Upload prepare/finalize/discard use POST to `/api/workspaces/<id>/lab-imaging/result-attachments`; DELETE uses a result/attachment-scoped route. A complete synthetic fixture must model prepare, signed URL upload, finalize, cleanup after cancellation and failed cleanup.
- `src/features/lab-imaging/components/lab-result-upload-transport.ts:10` uses `XMLHttpRequest` PUT plus native progress and abort events. A fetch-only mock cannot exercise or isolate this transport. A controlled story transport/module mock or parent-owned request interception is needed, with synthetic signed URL bytes and no storage service access.
- Attachment cards/download/viewer/PDF thumbnail load bytes from protected attachment routes. Fixtures must agree on MIME type, file name, content, fetch/download behavior and PDF worker lifetime. Mock success alone is not byte/download or authorization proof.
- `LabResultRowDetail` delegates finding state to its caller; result summary/history sections use autosave and phase2 snapshot contracts. Full sheet coverage needs coherent result/row/attachment/revision state and caller-owned autosave acknowledgements rather than independent arrays.
- Required scope before adding: explicit endpoint + XHR strategy, deterministic synthetic fixture lifecycle, cleanup, and parent-scheduled browser proof. No runtime API change is needed or proposed here.

## App shell and command palette

- `src/shell/app-shell.tsx:121` consumes `useRouter`, pathname/search params, auth hydration, workspace-entry splash, hospital settings dirty state, chart editor flush state, layout store and workspace tabs store. Workspace switching mutates URL/tab/store/session state and must preserve unsaved work rules.
- The shell fetches live notification snapshots and dispatches mutation APIs; mounts staff presence reporting; resolves actual feature modules through the module registry. An inert `workspaceId` alone does not isolate these effects.
- `src/shell/workspace-frame.tsx` chooses module-provided slots, drawer families and right-panel routing; a correct synthetic shell needs a controlled ModuleDefinition and slot-availability/provider state rather than rendering one generic rectangle.
- `src/shell/global-command-palette.tsx:330` searches the workspace command endpoint after debounce and can invoke reception registration/profile stores or router navigation. Needs deterministic router/store/reset state and search fixture responses, including no query, loading, empty, error and source-specific results.
- Required scope before adding: a resettable provider/store/router harness, controlled module slots, explicit notification/presence/search interception, and no unsandboxed auth/workspace persistence. Until then retain each shell source row and report app testing separately.
