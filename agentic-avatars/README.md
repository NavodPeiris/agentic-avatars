<div align="center">

<img src="https://raw.githubusercontent.com/NavodPeiris/agentic-avatars/main/top_banner.png" alt="Agentic Avatars" width="800" />

# agentic-avatars

Zero-Infrastructure Lip-Synced 3D avatar components for AI voice agents. Drop it into any React app, pick a provider, and hand it your credentials — everything else is handled internally. **No Infrastructure provisioning for 3D avatars. Runs Directly on Browser.**

Supported providers: **OpenAI Realtime API**, **Deepgram Voice Agents**, **ElevenLabs Conversational AI Agents**, **Vapi Agents**, **LiveKit Agents**.

</div>

## Requirements

| Peer dependency      | Version |
| -------------------- | ------- |
| `@react-three/drei`  | ≥ 10    |
| `@react-three/fiber` | ≥ 9     |
| `react`              | ≥ 18    |
| `react-dom`          | ≥ 18    |
| `three`              | ≥ 0.160 |

---

## Installation

```bash
npm install agentic-avatars
```

---

## Providers

- [OpenAI](#openai)
- [Deepgram](#deepgram)
- [ElevenLabs](#elevenlabs)
- [Vapi](#vapi)
- [LiveKit](#livekit)

---

## OpenAI

Uses the OpenAI Realtime API over WebRTC. Requires a server-side endpoint to mint ephemeral session keys.

```tsx
import { OpenAIAvatarAgent } from "agentic-avatars";

<OpenAIAvatarAgent
  systemPrompt="You are a friendly AI interviewer. Ask three questions, then say 'This is the end'."
  getEphemeralKey={async () => {
    const res = await fetch("/api/realtime-session");
    const { client_secret } = await res.json();
    return client_secret.value;
  }}
/>;
```

**Backend — ephemeral key endpoint**

```ts
// app/api/realtime-session/route.ts  (Next.js App Router)
export async function GET() {
  const res = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: "gpt-4o-realtime-preview-2024-12-17" }),
  });
  return Response.json(await res.json());
}
```

### Props

| Prop              | Type                        | Default      | Description                                                                                     |
| ----------------- | --------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `systemPrompt`    | `string`                    | **required** | Instructions injected into the realtime agent on connect.                                       |
| `getEphemeralKey` | `() => Promise<string>`     | **required** | Called once per connection. Must resolve to an OpenAI ephemeral key.                            |
| `tools`           | `ReturnType<typeof tool>[]` | `[]`         | Tools the agent can call. Use the `tool()` helper from `@openai/agents/realtime`.               |
| `agentVoice`      | `string`                    | `"sage"`     | OpenAI Realtime voice. Options: `alloy` `ash` `ballad` `coral` `echo` `sage` `shimmer` `verse`. |

---

## Deepgram

Uses the Deepgram Voice Agent API over WebSocket. Handles STT, LLM, and TTS in a single connection. **Never expose your Deepgram API key in the browser** — proxy it through your backend.

```tsx
import { DeepgramAvatarAgent } from "agentic-avatars";

<DeepgramAvatarAgent
  getApiKey={async () => {
    const res = await fetch("/api/deepgram-key");
    const { key } = await res.json();
    return key;
  }}
  systemPrompt="You are a helpful assistant."
  llm={{ provider: "open_ai", model: "gpt-4o-mini" }}
  voice="aura-2-thalia-en"
  sttModel="nova-3"
/>;
```

### Props

| Prop           | Type                    | Default                                         | Description                                                                                     |
| -------------- | ----------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `getApiKey`    | `() => Promise<string>` | **required**                                    | Returns a Deepgram API key. Proxy through your backend in production.                           |
| `systemPrompt` | `string`                | —                                               | System prompt / instructions for the LLM.                                                       |
| `llm`          | `{ provider?, model? }` | `{ provider: "open_ai", model: "gpt-4o-mini" }` | LLM provider and model. Providers: `open_ai` `anthropic` `x_ai` `groq` `amazon` `google`.       |
| `voice`        | `string`                | `"aura-2-thalia-en"`                            | Deepgram TTS voice. See [Deepgram TTS models](https://developers.deepgram.com/docs/tts-models). |
| `sttModel`     | `string`                | `"nova-3"`                                      | Deepgram STT model.                                                                             |

---

## ElevenLabs

Uses the ElevenLabs Conversational AI SDK. Configure your agent in the ElevenLabs dashboard and pass its ID here.

```tsx
import { ElevenLabsAvatarAgent } from "agentic-avatars";

// Public agent (no auth required)
<ElevenLabsAvatarAgent
  agentId="your-agent-id"
/>

// Private agent (fetch a short-lived token server-side)
<ElevenLabsAvatarAgent
  agentId="your-agent-id"
  getConversationToken={async () => {
    const res = await fetch("/api/elevenlabs-token");
    const { token } = await res.json();
    return token;
  }}
/>
```

**Backend — conversation token endpoint**

```ts
// app/api/elevenlabs-token/route.ts
export async function GET(req: Request) {
  const agentId = new URL(req.url).searchParams.get("agentId");
  const res = await fetch(
    `https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=${agentId}`,
    { headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! } },
  );
  return Response.json(await res.json());
}
```

### Props

| Prop                   | Type                               | Default      | Description                                                      |
| ---------------------- | ---------------------------------- | ------------ | ---------------------------------------------------------------- |
| `agentId`              | `string`                           | **required** | Agent ID from the ElevenLabs dashboard.                          |
| `getConversationToken` | `() => Promise<string>`            | —            | Required for private agents. Returns a short-lived WebRTC token. |
| `clientTools`          | `Record<string, (...args) => any>` | —            | Client-side tools exposed to the agent.                          |

---

## Vapi

Uses the Vapi Web SDK. Configure your assistant in the Vapi dashboard or pass an inline configuration object.

```tsx
import { VapiAvatarAgent } from "agentic-avatars";

// Using a pre-configured assistant ID
<VapiAvatarAgent
  publicKey="your-vapi-public-key"
  assistantId="your-assistant-id"
/>

// Using an inline assistant config
<VapiAvatarAgent
  publicKey="your-vapi-public-key"
  assistant={{
    model: {
      provider: "openai",
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: "You are a helpful assistant." }],
    },
    voice: { provider: "11labs", voiceId: "sarah" },
  }}
/>
```

### Props

| Prop          | Type                  | Default      | Description                                                                   |
| ------------- | --------------------- | ------------ | ----------------------------------------------------------------------------- |
| `publicKey`   | `string`              | **required** | Your Vapi public key (safe to expose in the browser).                         |
| `assistantId` | `string`              | —            | Pre-configured assistant ID. Mutually exclusive with `assistant`.             |
| `assistant`   | `Record<string, any>` | —            | Inline assistant configuration object. Mutually exclusive with `assistantId`. |

---

## LiveKit

Uses LiveKit Agents over WebRTC. Your LiveKit agent must be running server-side and the token must grant access to the correct room.

```tsx
import { LiveKitAvatarAgent } from "agentic-avatars";

<LiveKitAvatarAgent
  serverUrl="wss://my-project.livekit.cloud"
  getToken={async () => {
    const res = await fetch("/api/livekit-token");
    const { token } = await res.json();
    return token;
  }}
/>;
```

**Backend — participant token endpoint**

```ts
// app/api/livekit-token/route.ts
import { AccessToken } from "livekit-server-sdk";

export async function GET() {
  const token = new AccessToken(
    process.env.LIVEKIT_API_KEY!,
    process.env.LIVEKIT_API_SECRET!,
    { identity: `user-${Date.now()}` },
  );
  token.addGrant({ roomJoin: true, room: "agent-room" });
  return Response.json({ token: await token.toJwt() });
}
```

### Props

| Prop        | Type                    | Default      | Description                                                                                |
| ----------- | ----------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| `serverUrl` | `string`                | **required** | LiveKit server WebSocket URL, e.g. `wss://my-project.livekit.cloud`.                       |
| `getToken`  | `() => Promise<string>` | **required** | Returns a short-lived participant token. Generate server-side with the LiveKit server SDK. |

---

## Shared props

All provider components accept these additional props:

| Prop               | Type            | Default             | Description                                                                                        |
| ------------------ | --------------- | ------------------- | -------------------------------------------------------------------------------------------------- |
| `avatarComponent`  | `ComponentType` | `Jane`              | Avatar to render. Pass a library-provided avatar or any custom `React.ComponentType`.              |
| `backgroundImages` | `string[]`      | `[]`                | Image URLs for the scene background. One is chosen at random each mount. Transparent when omitted. |
| `onSessionEnd`     | `() => void`    | —                   | Called when the session ends (end phrase detected, timeout, or user clicked End).                  |
| `endSessionPhrase` | `string`        | `"this is the end"` | Case-insensitive substring the component watches for in the agent's transcript to end the session. |
| `sessionTimeout`   | `number`        | `600000`            | Hard timeout in milliseconds.                                                                      |
| `className`        | `string`        | —                   | Extra CSS class names on the outermost container `div`.                                            |

---

## Avatars

The library ships a built-in avatar that is used by default. You can also pass any React component that renders a 3D scene element (intended for use inside a `@react-three/fiber` `Canvas`).

```tsx
import { DeepgramAvatarAgent, Jane } from "agentic-avatars";

// Default — Jane is used automatically when avatarComponent is omitted
<DeepgramAvatarAgent getApiKey={...} />

// Explicit
<DeepgramAvatarAgent
  getApiKey={...}
  avatarComponent={Jane}
/>

// Custom avatar component
function MyAvatar() {
  // must be a valid R3F scene element
  return <mesh>...</mesh>;
}

<DeepgramAvatarAgent
  getApiKey={...}
  avatarComponent={MyAvatar}
/>
```

### Available avatars

| Export | Description                                                                 |
| ------ | --------------------------------------------------------------------------- |
| `Jane` | Female avatar with a face rig. Loads the model from jsDelivr automatically. |

---

## Advanced: adapter hooks

For full layout control, use `AvatarAgent` directly with an adapter hook. This lets you compose the avatar into your own UI without the built-in container styles.

```tsx
import { AvatarAgent, useDeepgramAdapter } from "agentic-avatars";

function MyPage() {
  const adapter = useDeepgramAdapter({
    getApiKey: async () => {
      const res = await fetch("/api/deepgram-key");
      return (await res.json()).key;
    },
    systemPrompt: "You are a helpful assistant.",
  });

  return (
    <div className="my-layout">
      <AvatarAgent adapter={adapter} className="h-[600px]" />
    </div>
  );
}
```

All adapter hooks follow the same pattern:

```ts
useOpenAIAdapter(options); // → SessionAdapter
useDeepgramAdapter(options); // → SessionAdapter
useElevenLabsAdapter(options); // → SessionAdapter
useVapiAdapter(options); // → SessionAdapter
useLiveKitAdapter(options); // → SessionAdapter
```

---

## How it works

```
User clicks Start
      │
      ▼
Provider adapter connects (WebRTC / WebSocket)
      │
      ├── Audio stream ──► Web Audio AnalyserNode ──► wawa-lipsync ──► morph targets on avatar
      │
      ├── Transcript ──► endSessionPhrase check ──► onSessionEnd()
      │
      └── sessionTimeout ──► onSessionEnd()
```

---

## Package structure

```
src/
├── index.ts                    ← public exports
├── types.ts                    ← shared prop types
├── AvatarAgent.tsx             ← platform-agnostic core component
├── OpenAIAvatarAgent.tsx       ← provider convenience wrappers
├── DeepgramAvatarAgent.tsx
├── ElevenLabsAvatarAgent.tsx
├── VapiAvatarAgent.tsx
├── LiveKitAvatarAgent.tsx
├── avatars/
│   └── ...              ← contains avatar components
├── adapters/
│   ├── SessionAdapter.ts       ← adapter interface
│   ├── openai/
│   ├── deepgram/
│   ├── elevenlabs/
│   ├── vapi/
│   └── livekit/
├── scene/
│   ├── AvatarScene.tsx         ← camera, lights, transparency fix
│   └── Background.tsx          ← scene background from image array
└── audio/
    ├── lipsyncManager.ts       ← singleton Lipsync instance
    ├── useLipsync.ts           ← wires audio stream into lipsync analyser
    └── useAudio.ts             ← mic monitoring
```

all avatars have a component and 3D models were delivered though jsDelivr via this Repo's `models` branch.

### This Avatar Library is Growing!

## How to create your own Avatar Component

first you should make sure your 3D model has face morphs with morph targets. These morph targets can be controlled via react three fiber. Then convert model to be usable in JS runtime using https://github.com/pmndrs/gltfjsx

```
1. create your 3D model with face morphs
2. convert your model using by running: npx gltfjsx your_model.glb --transform
3. this will provide an optimized glb and model JSX file. Adopt the JSX file to follow the format
4. now you have your model and react component
```

## Contribution Guide

- To contribute to package source code raise PRs to `main` branch
- To contribute to 3D models: raise the PR to `models` branch adding a separate folder with the avatar name and GLB file in it. Then raise a PR to `main` to add the avatar component — follow the format in `src/avatars/Jane.tsx`.

---

## Sponsoring

**agentic-avatars is free, open-source, and maintained in personal time.**

If your product ships AI-powered conversations and this library saves you weeks of WebRTC wrangling, lip-sync work, and provider integration — consider sponsoring. Even a small recurring amount keeps new avatar models coming, more providers supported, and bugs fixed fast.

[**Sponsor on GitHub →**](https://github.com/sponsors/navodPeiris)

---

## Citing this project

If you use agentic-avatars in academic work, a research demo, or a published product, a citation or acknowledgement is appreciated.

**BibTeX**

```bibtex
@software{peiris2025agenticavatars,
  author  = {Peiris, Navod},
  title   = {agentic-avatars: Zero-Infrastructure Lip-Synced 3D avatar components for AI voice agents},
  year    = {2026},
  url     = {https://github.com/navodPeiris/agentic-avatars},
  note    = {npm: agentic-avatars}
}
```

**Plain text**

> Navod Peiris. _agentic-avatars: Zero-Infrastructure Lip-Synced 3D avatar components for AI voice agents._ 2026. https://github.com/navodPeiris/agentic-avatars

**Acknowledgement (for README or paper footnote)**

> 3D avatar and lip-sync powered by [agentic-avatars](https://github.com/navodPeiris/agentic-avatars).
