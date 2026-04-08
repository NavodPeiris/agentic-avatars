import { AvatarAgent } from './AvatarAgent';
import { useOpenAIAdapter } from './adapters/openai/useOpenAIAdapter';
import type { OpenAIAvatarAgentProps } from './types';

/**
 * Lip-synced 3D avatar driven by the OpenAI Realtime API over WebRTC.
 *
 * @param systemPrompt - Instructions injected into the realtime agent on every
 *   new connection. Computed dynamically if needed — the full string is sent
 *   fresh each time `connect()` is called.
 *
 * @param getEphemeralKey - Async function that returns a short-lived OpenAI
 *   ephemeral key. **Never call the OpenAI API directly from the browser** —
 *   proxy through your backend:
 *   ```ts
 *   getEphemeralKey={async () => {
 *     const res = await fetch('/api/realtime-session');
 *     const { client_secret } = await res.json();
 *     return client_secret.value;
 *   }}
 *   ```
 *
 * @param tools - Optional tools the agent can call, created with the `tool()`
 *   helper from `@openai/agents/realtime`.
 *
 * @param agentVoice - OpenAI Realtime voice ID. Defaults to `"sage"`.
 *   Options: `alloy` | `ash` | `ballad` | `coral` | `echo` | `sage` | `shimmer` | `verse`.
 *
 * @param avatarComponent - React component to render as the avatar. Defaults to
 *   the built-in `Camila`. Pass any `React.ComponentType` for a custom avatar.
 *
 * @param backgroundImages - Array of image URLs for the scene background. One
 *   is chosen at random each mount. Transparent when omitted.
 *
 * @param onSessionEnd - Called when the session ends — end phrase detected,
 *   timeout elapsed, or the user clicked End.
 *
 * @param endSessionPhrase - Case-insensitive substring the component watches
 *   for in the agent transcript to end the session. Defaults to `"this is the end"`.
 *
 * @param sessionTimeout - Hard timeout in milliseconds. Defaults to `600000` (10 min).
 *
 * @param className - Extra CSS class names on the outermost container `div`.
 */
export function OpenAIAvatarAgent({
  systemPrompt,
  tools,
  agentVoice,
  getEphemeralKey,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  avatarComponent,
  className,
}: OpenAIAvatarAgentProps) {
  const adapter = useOpenAIAdapter({ systemPrompt, tools, agentVoice, getEphemeralKey });

  return (
    <AvatarAgent
      adapter={adapter}
      backgroundImages={backgroundImages}
      onSessionEnd={onSessionEnd}
      endSessionPhrase={endSessionPhrase}
      sessionTimeout={sessionTimeout}
      avatarComponent={avatarComponent}
      className={className}
    />
  );
}
