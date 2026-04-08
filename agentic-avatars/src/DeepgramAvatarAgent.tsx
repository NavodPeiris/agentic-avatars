import { AvatarAgent } from './AvatarAgent';
import { useDeepgramAdapter } from './adapters/deepgram/useDeepgramAdapter';
import type { DeepgramAvatarAgentProps } from './types';

/**
 * Lip-synced 3D avatar driven by the Deepgram Voice Agent API over WebSocket.
 * Deepgram handles STT, LLM, and TTS in a single connection — no separate
 * audio pipeline required.
 *
 * @param getApiKey - Async function that returns a Deepgram API key.
 *   **Never expose your API key directly in the browser** — proxy through your backend:
 *   ```ts
 *   getApiKey={async () => {
 *     const res = await fetch('/api/deepgram-key');
 *     const { key } = await res.json();
 *     return key;
 *   }}
 *   ```
 *
 * @param systemPrompt - System prompt / instructions passed to the LLM.
 *
 * @param llm - LLM provider and model configuration. Defaults to OpenAI gpt-4o-mini.
 *   ```ts
 *   llm={{ provider: 'open_ai', model: 'gpt-4o-mini' }}
 *   ```
 *   Supported providers: `open_ai` | `anthropic` | `x_ai` | `groq` | `amazon` | `google`.
 *
 * @param voice - Deepgram TTS voice name. Defaults to `"aura-2-thalia-en"`.
 *   See https://developers.deepgram.com/docs/tts-models for available voices.
 *
 * @param sttModel - Deepgram STT model. Defaults to `"nova-3"`.
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
export function DeepgramAvatarAgent({
  getApiKey,
  systemPrompt,
  llm,
  voice,
  sttModel,
  backgroundImages,
  onSessionEnd,
  endSessionPhrase,
  sessionTimeout,
  avatarComponent,
  className,
}: DeepgramAvatarAgentProps) {
  const adapter = useDeepgramAdapter({ getApiKey, systemPrompt, llm, voice, sttModel });

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
