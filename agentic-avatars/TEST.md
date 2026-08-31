# Local build & test flow

This document covers how to typecheck, build, and verify the package locally — both in isolation and wired into the host app.

---

## 1. Install package dependencies

```bash
cd agentic-avatars
pnpm install
```

This installs the TypeScript compiler and type stubs used for the type-check step. The heavy runtime dependency (`@myned-ai/gsplat-flame-avatar-renderer`) is a peer dependency supplied by the host app, so it is not duplicated here. `onnxruntime-web` is a regular dependency and installs normally.

---

## 2. Type-check

Run the TypeScript compiler in no-emit mode to verify there are no type errors across the whole package:

```bash
# from agentic-avatars/
pnpm tsc --noEmit
```

Expected output: silence (no errors). Any `error TS…` line needs to be fixed before merging.

Common things to check when errors appear:

| Error pattern                                                  | Likely cause                                                                       |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `Cannot find module '@myned-ai/gsplat-flame-avatar-renderer'`  | Run `pnpm install` first — the host app must supply this peer dependency          |
| `Cannot find module 'onnxruntime-web'`                         | Run `pnpm install` first — it's a regular dependency, not a peer                  |
| `Type … is not assignable to type 'tool'`                      | Wrong import — use `tool` from `@openai/agents/realtime`, not from `@openai/agents` |

---

## 3. Test package in host app

build package:

```bash
cd agentic-avatars
pnpm i
pnpm build
```

test in host app:

```bash
cd test-env
pnpm i
# import any test agent from src/examples into App.tsx and test
pnpm start
```

### What to verify

| Check                                                     | Expected |
| ----------------------------------------------------------- | -------- |
| Page loads without console errors                         | ✓        |
| Spinner shows while the avatar bundle + ONNX model download | ✓        |
| Avatar appears after loading finishes                      | ✓        |
| Reloading the page loads the ONNX model from cache (faster, check the Network tab) | ✓        |
| **Start** button is visible                                | ✓        |
| Clicking **Start** prompts mic permission                   | ✓        |
| Avatar mouth moves when agent speaks                       | ✓        |
| Clicking **End** disconnects cleanly                       | ✓        |
| `onSessionEnd` fires on phrase / timeout                    | ✓        |
| No errors in Network tab (WebRTC connected)                | ✓        |

### Mobile verification

Open Chrome DevTools → Toggle Device Toolbar → choose a phone preset, then reload. Additional checks:

| Check                                          | Expected |
| ------------------------------------------------- | -------- |
| Avatar renders without WebGL errors on mobile GPU tier | ✓        |
| Lipsync still keeps up in near-real-time on mobile CPU (WASM inference) | ✓        |

---

## 6. Type-check the host app with the package included

After wiring the alias, run the host app's own type-check to catch any interface mismatches:

```bash
# from host app
pnpm tsc --noEmit
```

---

## 8. Pre-publish checklist

Before bumping the version and publishing to npm, confirm all of the following:

- [ ] `pnpm tsc --noEmit` passes with zero errors (run from `agentic-avatars/`)
- [ ] Smoke test page works on desktop Chrome
- [ ] Smoke test page works on mobile Chrome (DevTools device emulation)
- [ ] `onSessionEnd` fires correctly via `endSessionPhrase`
- [ ] `onSessionEnd` fires correctly via `sessionTimeout`
- [ ] Custom `tools` are called by the agent as expected
- [ ] Custom `backgroundImages` array cycles correctly (refresh a few times)
- [ ] Omitting `assetsPath` loads the built-in Nyx avatar from jsDelivr at `https://cdn.jsdelivr.net/npm/agentic-avatars@<version>/assets/nyx.zip` — verify this URL 404s until the version is actually published (jsDelivr only mirrors published npm versions)
- [ ] A different `assetsPath` loads a different avatar bundle without errors
- [ ] Unmounting the component (navigate away) produces no console errors
- [ ] `package.json` `version` is bumped following semver
- [ ] `npm pack --dry-run` includes `assets/nyx.zip` in the tarball

---

## 9. Publishing

```bash
cd agentic-avatars

# dry run — inspect what will be included
npm pack --dry-run

# build the dist
npm build

# log into npm
npm login

# access token register
npm config set //registry.npmjs.org/:_authToken=<auth token>

# publish
npm publish --access public
```

> The `main` and `types` fields in `package.json` both point to `src/index.ts`. If consumers need a pre-compiled output, add a build step (`tsc --outDir dist`) and update those fields to point into `dist/` before publishing.
