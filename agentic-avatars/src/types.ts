import type React from 'react';

export type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

// ── Shared base props (common across all platform wrappers) ───────────────────

interface BaseAvatarAgentProps {
  /** Array of background image URLs. One is chosen at random each mount. */
  backgroundImages?: string[];

  /** Called when the agent ends the session (timeout or agent-triggered). */
  onSessionEnd?: () => void;

  /**
   * Phrase the agent says to signal the session should end.
   * Case-insensitive substring match against the transcript.
   * Defaults to `"this is the end"`.
   */
  endSessionPhrase?: string;

  /** Session hard-timeout in milliseconds. Defaults to 10 minutes. */
  sessionTimeout?: number;

  /**
   * React component to render as the avatar. Defaults to
   *  the built-in `Jane`. Pass any `React.ComponentType` for a custom avatar.
   */
  avatarComponent?: React.ComponentType;

  /** Extra class names applied to the outer container div. */
  className?: string;
}

// ── OpenAI ────────────────────────────────────────────────────────────────────

/** A function tool exposed to the OpenAI Realtime agent. */
export interface OpenAIRealtimeTool {
  /** Name the model uses to call this tool. */
  name: string;
  /** Description of what the tool does. */
  description: string;
  /** JSON Schema object for the tool's parameters. */
  parameters: Record<string, unknown>;
  /** Called when the model invokes the tool. Return value is sent back as the tool output. */
  handler?: (args: Record<string, unknown>) => unknown | Promise<unknown>;
}

export interface OpenAIAvatarAgentProps extends BaseAvatarAgentProps {
  /** System prompt injected into the realtime agent on connect. */
  systemPrompt: string;

  /**
   * Tools to expose to the realtime agent.
   * Each entry is a plain object with `name`, `description`, `parameters` (JSON Schema),
   * and an optional `handler` function called when the model invokes the tool.
   */
  tools?: OpenAIRealtimeTool[];

  /** Must return a valid OpenAI ephemeral key for the realtime session. */
  getEphemeralKey: () => Promise<string>;

  /** Voice for the realtime agent. Defaults to `"sage"`. */
  agentVoice?: string;
}

// ── Vapi ──────────────────────────────────────────────────────────────────────

export interface VapiAvatarAgentProps extends BaseAvatarAgentProps {
  /** Your Vapi public key (safe to expose in the browser). */
  publicKey: string;

  /**
   * Pre-configured assistant ID from the Vapi dashboard.
   * Mutually exclusive with `assistant`.
   */
  assistantId?: string;

  /**
   * Inline assistant configuration object.
   * Mutually exclusive with `assistantId`.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  assistant?: Record<string, any>;
}

// ── ElevenLabs ────────────────────────────────────────────────────────────────

export interface ElevenLabsAvatarAgentProps extends BaseAvatarAgentProps {
  /** Agent ID from the ElevenLabs dashboard. */
  agentId: string;

  /**
   * Required for private/authenticated agents.
   * Fetch a short-lived WebRTC token server-side:
   *   GET https://api.elevenlabs.io/v1/convai/conversation/token?agent_id={agentId}
   *   Header: xi-api-key: <your-api-key>
   * If omitted, connects with agentId directly (public agents only).
   */
  getConversationToken?: () => Promise<string>;

  /** Optional client tools exposed to the agent. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientTools?: Record<string, (...args: any[]) => any>;
}

// ── Deepgram ──────────────────────────────────────────────────────────────────

export interface DeepgramAvatarAgentProps extends BaseAvatarAgentProps {
  /**
   * Returns a Deepgram API key.
   * For production, proxy through your backend — never expose the key in the browser.
   */
  getApiKey: () => Promise<string>;

  /** System prompt / instructions for the agent. */
  systemPrompt?: string;

  /** LLM provider and model. Defaults to OpenAI gpt-4o-mini. */
  llm?: {
    provider?: 'open_ai' | 'anthropic' | 'google' | 'aws_bedrock';
    model?: string;
  };

  /**
   * TTS voice name. Defaults to 'aura-2-thalia-en'.
   * See https://developers.deepgram.com/docs/tts-models for options.
   */
  voice?: string;

  /** STT model. Defaults to 'nova-3'. */
  sttModel?: string;
}

// ── LiveKit ───────────────────────────────────────────────────────────────────

export interface LiveKitAvatarAgentProps extends BaseAvatarAgentProps {
  /** LiveKit server WebSocket URL, e.g. wss://my-project.livekit.cloud */
  serverUrl: string;

  /**
   * Returns a short-lived participant token for the LiveKit room.
   * Generate server-side using the LiveKit server SDK.
   */
  getToken: () => Promise<string>;
}

