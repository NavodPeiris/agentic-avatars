import type { tool } from '@openai/agents/realtime';

export type SessionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED';

export interface AvatarAgentProps {
  /** System prompt injected into the realtime agent on connect. */
  systemPrompt: string;

  /** Tools created with the `tool()` helper from `@openai/agents/realtime`. */
  tools?: ReturnType<typeof tool>[];

  /**
   * Array of background image URLs. One is chosen at random each mount.
   * Defaults to a plain dark background when omitted.
   */
  backgroundImages?: string[];

  /** Must return a valid OpenAI ephemeral key for the realtime session. */
  getEphemeralKey: () => Promise<string>;

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

  /** Voice for the realtime agent. Defaults to `"sage"`. */
  agentVoice?: string;

  /** Path to the avatar GLB model. Defaults to `https://cdn.jsdelivr.net/gh/<username>/<repo>@<version_or_branch>/<path_to_file>.glb`. */
  modelPath?: string;

  /** Extra class names applied to the outer container div. */
  className?: string;
}
