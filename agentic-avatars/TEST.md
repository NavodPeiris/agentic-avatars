# Local build & test flow

This document covers how to typecheck, build, and verify the package locally — both in isolation and wired into the host app.

---

## 1. Install package dependencies

```bash
cd agentic-avatars
pnpm install
```

This installs the TypeScript compiler and type stubs used for the type-check step. The heavy runtime dependencies (`three`, `@react-three/fiber`, etc.) are peer dependencies supplied by the host app, so they are not duplicated here.

---

## 2. Type-check

Run the TypeScript compiler in no-emit mode to verify there are no type errors across the whole package:

```bash
# from agentic-avatars/
pnpm tsc --noEmit
```

Expected output: silence (no errors). Any `error TS…` line needs to be fixed before merging.

Common things to check when errors appear:

| Error pattern                             | Likely cause                                                                                   |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `Cannot find module 'wawa-lipsync'`       | Run `pnpm install` first; or stub the types (see below)                                        |
| `Property X does not exist on type Mesh`  | Three.js type version mismatch — align `@types/three` with the `three` version in the host app |
| `Type … is not assignable to type 'tool'` | Wrong import — use `tool` from `@openai/agents/realtime`, not from `@openai/agents`            |

### Stubbing missing types temporarily

If `wawa-lipsync` has no bundled types, add a shim file to unblock the type-check:

```ts
// agentic-avatars/src/wawa-lipsync.d.ts
declare module "wawa-lipsync" {
  export const VISEMES: Record<string, string>;
  export class Lipsync {
    constructor(opts?: { fftSize?: number; historySize?: number });
    viseme: string;
    processAudio(): void;
  }
}
```

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

| Check                                       | Expected |
| ------------------------------------------- | -------- |
| Page loads without console errors           | ✓        |
| Canvas renders (no white box)               | ✓        |
| Spinner shows while GLB loads               | ✓        |
| Avatar appears after model loads            | ✓        |
| **Start** button is visible                 | ✓        |
| Clicking **Start** prompts mic permission   | ✓        |
| Avatar mouth moves when agent speaks        | ✓        |
| Clicking **End** disconnects cleanly        | ✓        |
| `onSessionEnd` fires on phrase / timeout    | ✓        |
| No errors in Network tab (WebRTC connected) | ✓        |

### Mobile verification

Open Chrome DevTools → Toggle Device Toolbar → choose a phone preset, then reload. Additional checks:

| Check                                    | Expected                       |
| ---------------------------------------- | ------------------------------ |
| No black patches on avatar face          | ✓                              |
| Hair and eyelashes fully visible         | ✓                              |
| Eyes not overly transparent              | ✓                              |
| Lighter shadow map (`basic`) used        | ✓ (check no shadow flickering) |
| Higher exposure compensates mobile gamma | ✓ (avatar not too dark)        |

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
- [ ] Custom `modelPath` loads a different GLB without errors
- [ ] Unmounting the component (navigate away) produces no console errors
- [ ] `package.json` `version` is bumped following semver

---

## 9. Publishing

```bash
cd agentic-avatars

# dry run — inspect what will be included
npm pack --dry-run

# publish
npm publish --access public
```

> The `main` and `types` fields in `package.json` both point to `src/index.ts`. If consumers need a pre-compiled output, add a build step (`tsc --outDir dist`) and update those fields to point into `dist/` before publishing.
