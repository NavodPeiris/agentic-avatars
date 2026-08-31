// Substituted at build time by tsup (see tsup.config.ts's `define`) with
// the published package version. Read via a `globalThis` property access
// (rather than a bare identifier) so no ambient type declaration is
// needed — this file also gets compiled as-is by consumers that alias
// straight to source (e.g. a dev harness), where the substitution never
// runs and this safely evaluates to `undefined` at runtime.
const injectedVersion = (globalThis as Record<string, unknown>).__AGENTIC_AVATARS_VERSION__;
const VERSION = typeof injectedVersion === 'string' ? injectedVersion : 'latest';

/**
 * Default avatar bundle: "Nyx", shipped inside the package itself
 * (`assets/nyx.zip`) and served via jsDelivr's npm CDN, which mirrors
 * every published package's contents automatically — no separate hosting
 * needed. Used whenever `assetsPath` isn't provided.
 */
export const DEFAULT_ASSETS_PATH = `https://cdn.jsdelivr.net/npm/agentic-avatars@${VERSION}/assets/nyx.zip`;
