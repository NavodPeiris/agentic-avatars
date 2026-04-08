# agentic-avatars

Embeddable React component that renders a lip-synced 3D avatar driven by an OpenAI Realtime voice session. Drop it into any React app and hand it a system prompt, tools, and background images — everything else is handled internally.

---

## Requirements

| Peer dependency | Version |
| --------------- | ------- |
| `react`         | ≥ 18    |
| `react-dom`     | ≥ 18    |

Your bundler must be able to handle `.glb` model files served from the `public/` directory (standard for Next.js / Vite).

---

## Installation

```bash
npm install agentic-avatars
```

---

## Quick start

```tsx
import { OpenAIAvatarAgent } from "agentic-avatars";

export default function InterviewPage() {
  return (
    <OpenAIAvatarAgent
      systemPrompt="You are a friendly AI interviewer. Ask the candidate three questions about their experience, then say 'This is the end' to close the session."
      getEphemeralKey={async () => {
        const res = await fetch("/api/realtime-session");
        const data = await res.json();
        return data.client_secret.value;
      }}
    />
  );
}
```

That's it. The component renders the avatar, manages the WebRTC session, drives lip sync, and cleans up on unmount.

---

## Props

```ts
interface OpenAIAvatarAgentProps {
  systemPrompt: string;
  tools?: ReturnType<typeof tool>[];
  backgroundImages?: string[];
  getEphemeralKey: () => Promise<string>;
  onSessionEnd?: () => void;
  endSessionPhrase?: string;
  sessionTimeout?: number;
  agentVoice?: string;
  modelPath?: string;
  className?: string;
}
```

### `systemPrompt` · `string` · **required**

Instructions injected into the realtime agent when the session starts. The full system prompt is sent fresh on every new connection, so you can compute it dynamically before passing it as a prop.

---

### `getEphemeralKey` · `() => Promise<string>` · **required**

Called once per connection attempt. Must resolve to a valid OpenAI ephemeral key for the Realtime API. Keep your secret key server-side; this function should call your own backend endpoint.

```ts
getEphemeralKey={async () => {
  const res = await fetch('/api/realtime-session');
  const { client_secret } = await res.json();
  return client_secret.value;
}}
```

---

### `tools` · `ReturnType<typeof tool>[]` · default `[]`

Tools the agent can call during the conversation. Use the `tool()` helper re-exported from this package — no extra import needed.

```tsx
import { OpenAIAvatarAgent, tool } from 'agentic-avatars';

const submitFeedback = tool({
  name: 'submitFeedback',
  description: 'Submit structured feedback after the conversation ends',
  parameters: {
    type: 'object',
    properties: {
      score:   { type: 'number', description: 'Score from 1 to 10' },
      summary: { type: 'string', description: 'Brief summary of the conversation' },
    },
    required: ['score', 'summary'],
    additionalProperties: false,
  },
  execute: async ({ score, summary }) => {
    await fetch('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ score, summary }),
    });
    return { ok: true };
  },
});

<OpenAIAvatarAgent
  systemPrompt="..."
  tools={[submitFeedback]}
  getEphemeralKey={...}
/>
```

---

### `backgroundImages` · `string[]` · default `[]`

Array of image URLs (absolute paths, relative paths, or full URLs). One is picked at random each time the component mounts. The 3D scene uses it as a full-scene background.

```tsx
backgroundImages={[
  '/backgrounds/office.jpg',
  '/backgrounds/lobby.jpg',
  '/backgrounds/meeting-room.jpg',
]}
```

When omitted the scene background is transparent, so the component's CSS background shows through.

---

### `onSessionEnd` · `() => void` · optional

Called when the session ends — either because the agent said the `endSessionPhrase`, the `sessionTimeout` elapsed, or the user clicked **End**. Use this to navigate away or trigger a post-session action.

```tsx
onSessionEnd={() => router.push('/results')}
```

---

### `endSessionPhrase` · `string` · default `"this is the end"`

Case-insensitive substring the component watches for in the agent's transcript. When detected, the session disconnects and `onSessionEnd` fires. Teach the agent to say this phrase at the natural conclusion of the conversation via `systemPrompt`.

```tsx
endSessionPhrase = "interview complete";
```

---

### `sessionTimeout` · `number` · default `600000` (10 minutes)

Hard timeout in milliseconds. The session disconnects automatically after this duration regardless of conversation state.

```tsx
sessionTimeout={5 * 60 * 1000} // 5 minutes
```

---

### `agentVoice` · `string` · default `"sage"`

OpenAI Realtime voice ID. Available voices: `alloy`, `ash`, `ballad`, `coral`, `echo`, `sage`, `shimmer`, `verse`.

```tsx
agentVoice = "coral";
```

---

### `modelPath` · `string` · default `"https://cdn.jsdelivr.net/gh/navodPeiris/agentic-avatars@models/camila/camila.glb"`

```tsx
modelPath = "/cdn/my-avatar.glb";
```

---

### `className` · `string` · optional

Extra CSS class names applied to the outermost container `div`. Useful for sizing the component within a layout.

```tsx
className = "w-full max-w-2xl mx-auto";
```

---

## Full example

```tsx
import { OpenAIAvatarAgent, tool } from "agentic-avatars";
import { useRouter } from "next/navigation";

const scoreCandidate = tool({
  name: "scoreCandidate",
  description: "Record the final score when the interview ends",
  parameters: {
    type: "object",
    properties: {
      transcript: { type: "string" },
      score: { type: "number" },
    },
    required: ["transcript", "score"],
    additionalProperties: false,
  },
  execute: async ({ transcript, score }) => {
    await fetch("/api/score", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, score }),
    });
    return { saved: true };
  },
});

export default function InterviewPage({ question }: { question: string }) {
  const router = useRouter();

  const systemPrompt = `
    You are an AI technical interviewer at Acme Corp.
    Ask the candidate: "${question}".
    Follow up with clarifying questions as needed.
    When finished, call the scoreCandidate tool, then say "This is the end".
  `;

  return (
    <OpenAIAvatarAgent
      systemPrompt={systemPrompt}
      tools={[scoreCandidate]}
      backgroundImages={[
        "/backgrounds/office-1.jpg",
        "/backgrounds/office-2.jpg",
      ]}
      getEphemeralKey={async () => {
        const res = await fetch("/api/realtime-session");
        const { client_secret } = await res.json();
        return client_secret.value;
      }}
      onSessionEnd={() => router.push("/results")}
      endSessionPhrase="this is the end"
      sessionTimeout={8 * 60 * 1000}
      agentVoice="sage"
      className="w-full max-w-4xl mx-auto"
    />
  );
}
```

---

## Backend: ephemeral key endpoint

The component never touches your OpenAI secret key directly. You need a small server-side endpoint that mints a short-lived session token:

```ts
// app/api/realtime-session/route.ts  (Next.js App Router)
export async function POST() {
  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-realtime-mini-2025-10-06" }),
  });
  const data = await res.json();
  return Response.json(data);
}
```

---

## How it works

```
User clicks Start
      │
      ▼
getEphemeralKey() ──► your backend ──► OpenAI /realtime/sessions
      │
      ▼
WebRTC session opens (RealtimeAgent with your systemPrompt + tools)
      │
      ├── Remote audio stream ──► Web Audio analyser ──► Lipsync ──► morph targets on avatar
      │
      ├── Agent transcript ──► endSessionPhrase check ──► onSessionEnd()
      │
      └── sessionTimeout ──► onSessionEnd()
```

---

## Package structure

```
src/
├── index.ts               ← public exports
├── types.ts               ← agent props
├── OpenAIAvatarAgent.tsx  ← main components
├── XXXXXXAvatarAgent.tsx
├── ....
├── scene/
│   ├── AvatarScene.tsx    ← camera, lights, mobile transparency fix
│   ├── Avatar.tsx         ← skinned mesh, morph targets, blink, lipsync
│   └── Background.tsx     ← scene.background from image array
├── audio/
│   ├── lipsyncManager.ts  ← singleton Lipsync instance
│   ├── useLipsync.ts      ← wires audio stream into lipsync analyser
│   └── useAudio.ts        ← mic + remote stream recorder
├── session/
│   ├── useAgentSession.ts ← connect / disconnect / mute
│   └── codecUtils.ts      ← WebRTC audio format helpers
└── utils/
    ├── isMobile.ts
    └── cn.ts
```
