import { AvatarAgent } from './AvatarAgent';
import { useOpenAIAdapter } from './adapters/openai/useOpenAIAdapter';
import type { OpenAIAvatarAgentProps } from './types';

/**
 * Lip-synced 3D avatar driven by the OpenAI Realtime API over WebRTC.
 *
 * @param getEphemeralKey - Async function that returns a short-lived OpenAI ephemeral key.
 *   Configure the model, voice, and system prompt (instructions) inside the session
 *   creation request. **Never call the OpenAI API directly from the browser** —
 *   proxy through your backend:
 *   ```ts
 *   getEphemeralKey={async () => {
 *     const res = await fetch('/api/realtime-session');
 *     const { client_secret } = await res.json();
 *     return client_secret.value;
 *   }}
 *   ```
 *
 *
 * @param assetsPath - URL/path to a hosted Gaussian-splat avatar asset bundle. Defaults to the built-in "Nyx" avatar.
 *
 * @param backgroundImages - Array of image URLs for the scene background.
 *
 * @param onSessionEnd - Called when the session ends.
 *
 * @param endSessionPhrase - Phrase watched in the transcript to end the session.
 *
 * @param sessionTimeout - Hard timeout in milliseconds. Defaults to `600000` (10 min).
 *
 * @param className - Extra CSS class names on the outermost container `div`.
 */
export function OpenAIAvatarAgent({
  getEphemeralKey,
  agentVoice,
  tools,
  assetsPath,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  className,
}: OpenAIAvatarAgentProps) {
  const adapter = useOpenAIAdapter({ getEphemeralKey, agentVoice, tools });

  return (
    <AvatarAgent
      adapter={adapter}
      assetsPath={assetsPath}
      backgroundImages={backgroundImages}
      onSessionEnd={onSessionEnd}
      endSessionPhrase={endSessionPhrase}
      sessionTimeout={sessionTimeout}
      className={className}
    />
  );
}
