---
date: 2026-09-24
title: "Copy and adapt the desktop web app for the admin UI"
---

# 2026-09-24 — Copy and adapt the desktop web app for the admin UI

- **Context:** The `atc` daemon serves a web admin for people who prefer a browser to a terminal. The
  desktop app's `Atomic-Chat/web-app` (React 19, Vite 6, TanStack Router, Zustand 5, Tailwind 4,
  shadcn) already has the pages a server admin needs — API server, models and downloads, backends,
  hardware, proxy and privacy settings — built on a `ServiceHub` abstraction whose Tauri implementations
  call `invoke`, and on `extensions/shared/atomicCoreRuntime.ts`, a request builder for the core's control
  API that imports nothing and takes `invoke` as a parameter. The app and `atc` are separate products for
  different audiences with separate release trains, and no runtime link between them is planned (D4, D6).
  The question was how much of `web-app` to reuse and by what mechanism.
- **Decision:** Copy and adapt. `packages/admin-ui` uses the same stack and **mirrors the structure of
  `web-app/src`** (`routes/ containers/ components/ui/ hooks/ services/ stores/ lib/`) so that files lift
  1:1. Every lifted file starts with `// Lifted from Atomic-Chat/web-app/src/<path> @ <commit>; adapted: …`
  and has a line in `packages/admin-ui/LIFTED.md`. Exactly one seam is replaced: `services/core-bridge.ts`
  provides `createHttpInvoke()` with Tauri's `invoke` shape, mapping `atomic_core_call` to
  `fetch('/api/core' + path)`, `atomic_core_snapshot` and `atomic_core_status` to the BFF;
  `services/atomic-core-runtime.ts` is a verbatim copy of the app's builder. Events come from
  `EventSource('/api/events')` through `useCoreEvents(name, handler)`, the counterpart of the app's
  `atomic-core://<event>` listeners. `ServiceHub` interface names are kept and `AdminServiceHub` implements
  the subset the admin needs; Tauri-specific services, the models default service, the backend updater and
  `lib/utils.ts` are rewritten thinly against the BFF routes; `lib/platform.ts` reports platform `'admin'`
  with every server feature on. Wire types are `src/admin/contract` (browser-safe) and
  `@atomic-chat/core/contracts`, never copies. **No shared UI package with the app.** Trigger for revisiting:
  if the same fix has to be ported by hand into a lifted file three times, or if the app itself moves to
  consuming the core from a browser-hosted UI over HTTP, write a new ADR about a shared package.
- **Consequences:** The first real page (Dashboard: status, snapshot, live events) and the shell arrived
  with the scaffold, and pages 2–8 can lift tested containers rather than start from nothing. Duplication is
  accepted deliberately: two copies of the shadcn components and the stores, each free to diverge; the
  provenance header is what makes a targeted backport possible (diff against the recorded commit). The
  admin needs its own eslint (browser/React) and vitest (jsdom) configuration, its own CI job, and the root
  gates ignore the package. A lifted file must lose every Tauri import before it compiles here; the
  `adapted:` note in the header says what changed. Lifting brings the app's assumptions (a single local
  machine, a desktop window) that the admin must override in `lib/platform.ts` rather than sprinkle checks.
  The bridge keeps the security model intact: the page never sees the control token or the core's port,
  and every call goes through the BFF's allowlist and gates.
- **Alternatives:** *A shared npm package with the app* (`@atomicbot-ai/ui`): couples the app's release
  train to `atc`'s, forces the app to publish and version internal components, and D6 rules out
  cross-product dependencies — rejected, with the trigger above. *A fresh, minimal admin*: cheaper for the
  Dashboard, but throws away containers that already encode the core's edge cases (download stages, backend
  mismatch warnings, API key handling) — rejected. *Server-rendered HTML from the daemon*: no live events
  without a client anyway, more code in the BFF, and none of the app's pages reusable — rejected.
  *An iframe of the app's web build*: the app's build assumes Tauri globals and a window, and a full copy
  of the chat UI is not what a server admin wants — rejected.
- **Owner:** team.
- **Links:** `packages/admin-ui/` (`package.json`, `LIFTED.md`, `src/services/core-bridge.ts`,
  `src/services/atomic-core-runtime.ts`, `src/services/events.ts`); `src/admin/contract/`; `src/admin/bff.ts`
  (the allowlist the bridge is subject to); `Atomic-Chat/web-app/src`, `Atomic-Chat/extensions/shared/atomicCoreRuntime.ts`;
  plan D4, D6, §6; `docs/admin-ui.md`; ADR 2026-09-24 "Embed the admin UI as a generated module".
