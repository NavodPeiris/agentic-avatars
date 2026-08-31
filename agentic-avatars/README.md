<div align="center">

<img src="https://raw.githubusercontent.com/NavodPeiris/agentic-avatars/main/top_banner.png" alt="Agentic Avatars" width="800" />

<img alt="NPM Version" src="https://img.shields.io/npm/v/agentic-avatars">
<img alt="NPM Downloads" src="https://img.shields.io/npm/dy/agentic-avatars">
<img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/NavodPeiris/agentic-avatars">

# agentic-avatars

Zero-Infrastructure Lip-Synced Gaussian-Splat avatar components for AI voice agents. Drop it into any React app, pick a provider, and hand it your credentials — everything else is handled internally. **No infrastructure provisioning — Gaussian-splat rendering and wav2arkit neural lipsync both run directly in the browser.**

Supported providers: **OpenAI Realtime API**, **Deepgram Voice Agents**, **ElevenLabs Conversational AI Agents**, **Vapi Agents**, **LiveKit Agents**.

</div>

## Requirements

| Peer dependency                          | Version  |
| ----------------------------------------- | -------- |
| `@myned-ai/gsplat-flame-avatar-renderer`  | ≥ 1.4.0  |
| `react`                                   | ≥ 18     |
| `react-dom`                               | ≥ 18     |
| `@deepgram/sdk`                           | ≥ 5.0.0  |
| `@elevenlabs/react`                       | ≥ 1.0.2  |
| `@vapi-ai/web`                            | ≥ 2.5.2  |
| `livekit-client`                          | 2.16.1   |

Optional depending on your provider usecase:

`@deepgram/sdk`  
`@elevenlabs/react`  
`@vapi-ai/web`  
`livekit-client`

---

## Installation

```bash
npm install agentic-avatars
```

---

## Breaking changes (v0.2)

Rendering moved from React Three Fiber + GLB meshes to
[`@myned-ai/gsplat-flame-avatar-renderer`](https://www.npmjs.com/package/@myned-ai/gsplat-flame-avatar-renderer)
(Gaussian Splatting), and lipsync moved from the amplitude-heuristic
`wawa-lipsync` package to the `wav2arkit` neural model, running client-side
via `onnxruntime-web`. If you're upgrading:

- `avatarComponent` is removed. Pass `assetsPath` instead (optional — see
  [Avatars](#avatars) below).
- The built-in `Jane` / `Fiona` / `Sam` exports are removed, replaced by a
  single built-in default avatar, "Nyx", used automatically when
  `assetsPath` is omitted.
- `@react-three/fiber`, `@react-three/drei`, and `three` are no longer peer
  dependencies.

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
import { OpenAIAvatarAgent } from "agentic-avatars/openai";
import type { OpenAIRealtimeTool } from "agentic-avatars";

const tools: OpenAIRealtimeTool[] = [
  {
    name: "get_product_price",
    description: "Returns the current price of a product.",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Name of the product" },
      },
      required: ["product_name"],
    },
    handler: ({ product_name }) => {
      const prices: Record<string, string> = {
        "apple iphone 15 pro max": "$1,199",
        "samsung galaxy s23 ultra": "$1,099",
        "sony wh-1000xm5": "$349",
        "dell xps 13": "$999",
        "amazon echo dot": "$49",
      };
      const price =
        prices[(product_name as string).toLowerCase()] ?? "Price not available";
      return { product_name, price };
    },
  },
];

<OpenAIAvatarAgent
  backgroundImages={["/niceBG.jpg"]}
  agentVoice="nova"
  tools={tools}
  getEphemeralKey={async () => {
    const res = await fetch("/api/realtime-session");
    const { client_secret } = await res.json();
    return client_secret;
  }}
/>;
```

**Backend — ephemeral key endpoint**

```ts
// app/api/realtime-session/route.ts  (Next.js App Router)
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
});

const sys_prompt = `
# ROLE
You are a product recommendation assistant for Amazon who answers user questions and recommends products based on their preferences.
at initial greeting, say 'Hello! I am your product specialist at Amazon. I can help you find products — feel free to tell me what you are looking for!'
DO NOT repeat it again.

These are currently available products:
1. Apple iPhone 15 Pro Max - iPhone 15 Pro Max delivers premium performance with a lightweight titanium design, stunning 6.7-inch Super Retina XDR display with ProMotion, and the powerful A17 Pro chip. Capture incredible detail with its advanced Pro camera system featuring a 48MP main sensor and 5x optical zoom.
2. Samsung Galaxy S23 Ultra - A high-end Android phone with a stunning display, versatile cameras, and long battery life.
3. Sony WH-1000XM5 Wireless Noise-Canceling Headphones - Premium headphones with industry-leading noise cancellation, exceptional sound quality, and comfortable design.
4. Dell XPS 13 Laptop - A sleek and powerful ultrabook with a stunning InfinityEdge display, Intel Core i7 processor, and long battery life.
5. Amazon Echo Dot (5th Gen) - A compact smart speaker with Alexa voice assistant, perfect for controlling smart home devices, playing music, and getting information.
Always recommend products based on the user's preferences and needs. If the user asks for a specific product, provide information about it and suggest similar alternatives if available.
When the user says goodbye or is done, say "this is the end" to close the session.

# TOOLS
if user asks for product prices, use the get_product_price tool to retrieve the current price of the product and include it in your response.
`;

export async function GET() {
  const session = await openai.realtime.clientSecrets.create({
    session: {
      type: "realtime",
      model: "gpt-realtime-mini-2025-10-06",
      instructions: sys_prompt,
    },
  });

  return Response.json({ client_secret: session.value });
}
```

### Props

| Prop              | Type                        | Default      | Description                                                                                     |
| ----------------- | --------------------------- | ------------ | ----------------------------------------------------------------------------------------------- |
| `systemPrompt`    | `string`                    | **required** | Instructions injected into the realtime agent on connect.                                       |
| `getEphemeralKey` | `() => Promise<string>`     | **required** | Called once per connection. Must resolve to an OpenAI ephemeral key.                            |
| `tools`           | `ReturnType<typeof tool>[]` | `[]`         | Tools the agent can call. Use the `tool()` helper from `@openai/agents/realtime`.               |
| `agentVoice`      | `string`                    | `"sage"`     | OpenAI Realtime voice. Options: `alloy` `ash` `ballad` `coral` `echo` `sage` `shimmer` `verse`. |

Runs full wav2arkit neural lipsync — OpenAI's WebRTC session exposes a real remote `MediaStream`.

---

## Deepgram

Uses the Deepgram Voice Agent API over WebSocket. Handles STT, LLM, and TTS in a single connection. **Never expose your Deepgram API key in the browser** — proxy it through your backend.

```tsx
import { DeepgramAvatarAgent } from "agentic-avatars/deepgram";
import type { DeepgramTool } from "agentic-avatars";

const sys_prompt = `
# ROLE
You are a product recommendation assistant for Amazon who answers user questions and recommends products based on their preferences.
At initial greeting, say 'Hello! I am your product specialist at Amazon. I can help you find products — feel free to tell me what you are looking for!'
DO NOT repeat it again.

These are currently available products:
1. Apple iPhone 15 Pro Max - iPhone 15 Pro Max delivers premium performance with a lightweight titanium design, stunning 6.7-inch Super Retina XDR display with ProMotion, and the powerful A17 Pro chip.
2. Samsung Galaxy S23 Ultra - A high-end Android phone with a stunning display, versatile cameras, and long battery life.
3. Sony WH-1000XM5 Wireless Noise-Canceling Headphones - Premium headphones with industry-leading noise cancellation, exceptional sound quality, and comfortable design.
4. Dell XPS 13 Laptop - A sleek and powerful ultrabook with a stunning InfinityEdge display, Intel Core i7 processor, and long battery life.
5. Amazon Echo Dot (5th Gen) - A compact smart speaker with Alexa voice assistant, perfect for controlling smart home devices, playing music, and getting information.
Always recommend products based on the user's preferences and needs.
When the user says goodbye or is done, say "this is the end" to close the session.

# TOOLS
If the user asks for product prices, use the get_product_price tool to retrieve the current price and include it in your response.
`;

const tools: DeepgramTool[] = [
  {
    name: "get_product_price",
    description: "Returns the current price of a product.",
    parameters: {
      type: "object",
      properties: {
        product_name: { type: "string", description: "Name of the product" },
      },
      required: ["product_name"],
    },
    handler: ({ product_name }) => {
      const prices: Record<string, string> = {
        "apple iphone 15 pro max": "$1,199",
        "samsung galaxy s23 ultra": "$1,099",
        "sony wh-1000xm5": "$349",
        "dell xps 13": "$999",
        "amazon echo dot": "$49",
      };
      const price =
        prices[(product_name as string).toLowerCase()] ?? "Price not available";
      return { product_name, price };
    },
  },
];

export default function DeepgramAvatarTest() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <DeepgramAvatarAgent
        // YOU SHOULD NEVER EXPOSE YOUR DEEPGRAM API KEY IN THE BROWSER IN PRODUCTION.
        // FOR PRODUCTION USE: proxy the key through your backend.
        getApiKey={async () => process.env.REACT_APP_DEEPGRAM_API_KEY!}
        systemPrompt={sys_prompt}
        llm={{ provider: "open_ai", model: "gpt-4o-mini" }}
        voice="aura-2-thalia-en"
        sttModel="nova-3"
        tools={tools}
        backgroundImages={["/niceBG.jpg"]}
        onSessionEnd={() => alert("Session ended")}
        sessionTimeout={2 * 60 * 1000}
      />
    </div>
  );
}
```

### Props

| Prop           | Type                    | Default                                         | Description                                                                                     |
| -------------- | ----------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `getApiKey`    | `() => Promise<string>` | **required**                                    | Returns a Deepgram API key. Proxy through your backend in production.                           |
| `systemPrompt` | `string`                | —                                               | System prompt / instructions for the LLM.                                                       |
| `llm`          | `{ provider?, model? }` | `{ provider: "open_ai", model: "gpt-4o-mini" }` | LLM provider and model. Providers: `open_ai` `anthropic` `x_ai` `groq` `amazon` `google`.       |
| `voice`        | `string`                | `"aura-2-thalia-en"`                            | Deepgram TTS voice. See [Deepgram TTS models](https://developers.deepgram.com/docs/tts-models). |
| `sttModel`     | `string`                | `"nova-3"`                                      | Deepgram STT model.                                                                             |

Runs full wav2arkit neural lipsync — Deepgram's SDK doesn't expose a `MediaStream`, but this adapter decodes the raw PCM16 audio itself and feeds those samples straight into the lipsync engine.

---

## ElevenLabs

Uses the ElevenLabs Conversational AI SDK. Configure your agent in the ElevenLabs dashboard and pass its ID here.

```tsx
import { ElevenLabsAvatarAgent } from "agentic-avatars/elevenlabs";

// Public agent (no auth required)
<ElevenLabsAvatarAgent
  agentId="your-agent-id"
/>

// Private agent (fetch a short-lived token server-side)
<ElevenLabsAvatarAgent
  backgroundImages={["/niceBG.jpg"]}
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
| ---------------------- | ----------------------------------- | ------------ | ---------------------------------------------------------------- |
| `agentId`              | `string`                           | **required** | Agent ID from the ElevenLabs dashboard.                          |
| `getConversationToken` | `() => Promise<string>`            | —            | Required for private agents. Returns a short-lived WebRTC token. |
| `clientTools`          | `Record<string, (...args) => any>` | —            | Client-side tools exposed to the agent.                          |

> **Lipsync note:** the ElevenLabs SDK only exposes frequency-magnitude and volume scalars, never raw waveform audio, so the wav2arkit neural model can't run for this provider. ElevenLabs falls back to coarse, volume-driven mouth movement instead of full lipsync.

---

## Vapi

Uses the Vapi Web SDK. Configure your assistant in the Vapi dashboard or pass an inline configuration object.

```tsx
import { VapiAvatarAgent } from "agentic-avatars/vapi";

// Using a pre-configured assistant ID
<VapiAvatarAgent
  publicKey="your-vapi-public-key"
  assistantId="your-assistant-id"
/>

// Using an inline assistant config
<VapiAvatarAgent
  backgroundImages={["/niceBG.jpg"]}
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
| ------------- | ---------------------- | ------------ | ----------------------------------------------------------------------------- |
| `publicKey`   | `string`               | **required** | Your Vapi public key (safe to expose in the browser).                         |
| `assistantId` | `string`               | —            | Pre-configured assistant ID. Mutually exclusive with `assistant`.             |
| `assistant`   | `Record<string, any>` | —            | Inline assistant configuration object. Mutually exclusive with `assistantId`. |

Runs full wav2arkit neural lipsync — Vapi's Web SDK exposes a real remote `MediaStream`.

---

## LiveKit

Uses LiveKit Agents over WebRTC. Your LiveKit agent must be running server-side and the token must grant access to the correct room.

```tsx
import { LiveKitAvatarAgent } from "agentic-avatars/livekit";

<LiveKitAvatarAgent
  backgroundImages={["/niceBG.jpg"]}
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

Runs full wav2arkit neural lipsync — LiveKit's client exposes a real remote `MediaStream`.

---

## Shared props

All provider components accept these additional props:

| Prop                | Type         | Default              | Description                                                                                         |
| -------------------- | ------------ | -------------------- | ----------------------------------------------------------------------------------------------------- |
| `assetsPath`         | `string`     | built-in "Nyx" avatar | URL/path to a hosted Gaussian-splat avatar asset bundle. See [Avatars](#avatars) below.                |
| `backgroundImages`   | `string[]`   | `[]`                  | Image URLs for the background. One is chosen at random each mount. Transparent when omitted.          |
| `onSessionEnd`       | `() => void` | —                     | Called when the session ends (end phrase detected, timeout, or user clicked End).                      |
| `endSessionPhrase`   | `string`     | `"this is the end"`  | Case-insensitive substring the component watches for in the agent's transcript to end the session.     |
| `sessionTimeout`     | `number`     | `600000`             | Hard timeout in milliseconds.                                                                          |
| `className`          | `string`     | —                     | Extra CSS class names on the outermost container `div`.                                                |

---

## Avatars

The library ships with a built-in default avatar, **Nyx**, used automatically
when you don't pass `assetsPath` — nothing to configure, nothing to host.
The bundle lives inside the npm package (`assets/nyx.zip`) and is served via
[jsDelivr's npm CDN](https://www.jsdelivr.com/), which mirrors every
published package's contents automatically.

```tsx
// Uses the built-in Nyx avatar — no assetsPath needed
<OpenAIAvatarAgent getEphemeralKey={...} />
```

To use your own avatar instead, host a Gaussian-splat asset bundle
(compatible with
[`@myned-ai/gsplat-flame-avatar-renderer`](https://www.npmjs.com/package/@myned-ai/gsplat-flame-avatar-renderer))
and pass its URL as `assetsPath` — same "bring your own" model the library
used for custom R3F avatars before, just adapted to the new renderer's asset
format:

```tsx
<OpenAIAvatarAgent
  getEphemeralKey={...}
  assetsPath="https://your-cdn.example.com/avatars/your-avatar-bundle"
/>
```

---

## Advanced: adapter hooks

For full layout control, use `AvatarAgent` directly with an adapter hook. This lets you compose the avatar into your own UI without the built-in container styles.

```tsx
import { AvatarAgent } from "agentic-avatars";
import { useDeepgramAdapter } from "agentic-avatars/deepgram";

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
      <AvatarAgent
        adapter={adapter}
        className="h-[600px]"
      />
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

A `SessionAdapter` exposes `remoteStream` for full neural lipsync, plus two
optional fallbacks for platforms that can't produce a `MediaStream`:
`subscribeToRemoteAudio` (push already-decoded PCM straight into wav2arkit —
used by Deepgram) and `getRemoteAudioLevel` (a 0-1 volume scalar for coarse,
volume-only mouth movement — used by ElevenLabs). Implement one of these if
you're writing a custom adapter for a platform without a real audio stream.

---

## How it works

```
User clicks Start
      │
      ▼
Provider adapter connects (WebRTC / WebSocket)
      │
      ├── Audio ──► resample to 16kHz ──► wav2arkit (onnxruntime-web) ──► ARKit blendshapes ──► Gaussian-splat renderer
      │             (MediaStream tap, or pushed raw PCM — see Advanced: adapter hooks)
      │
      ├── Transcript ──► endSessionPhrase check ──► onSessionEnd(), End
      │
      ├── User clicks end ──► End
      |
      └── sessionTimeout ──► onSessionEnd(), End
```

The wav2arkit ONNX model
([myned-ai/wav2arkit_cpu](https://huggingface.co/myned-ai/wav2arkit_cpu), Apache-2.0)
is fetched and cached in the browser on first use — no server component
required.

---

## Package structure

```
src/
├── index.ts                    ← public exports
├── types.ts                    ← shared prop types
├── AvatarAgent.tsx              ← platform-agnostic core component
├── OpenAIAvatarAgent.tsx       ← provider convenience wrappers
├── DeepgramAvatarAgent.tsx
├── ElevenLabsAvatarAgent.tsx
├── VapiAvatarAgent.tsx
├── LiveKitAvatarAgent.tsx
├── avatar/
│   ├── GaussianAvatarController.ts   ← wraps @myned-ai/gsplat-flame-avatar-renderer
│   ├── LazyAvatarController.ts       ← lazy-loads the renderer + lipsync engine
│   └── AvatarContainer.tsx           ← React mount point + background image
├── constants/
│   └── arkit.ts                 ← ARKit blendshape names, neutral pose
├── adapters/
│   ├── SessionAdapter.ts        ← adapter interface
│   ├── openai/
│   ├── deepgram/
│   ├── elevenlabs/
│   ├── vapi/
│   └── livekit/
└── audio/
    ├── wav2arkit/
    │   ├── modelLoader.ts        ← fetches + caches the ONNX model
    │   ├── resample.ts           ← resamples audio to 16kHz
    │   ├── inferenceEngine.ts    ← onnxruntime-web session
    │   └── liveLipsync.ts        ← streaming/paced inference pipeline
    ├── useAvatarLipsync.ts       ← wires a MediaStream into wav2arkit
    ├── usePushAudioLipsync.ts    ← wires pushed raw PCM into wav2arkit
    ├── useVolumeFallbackLipsync.ts ← coarse fallback for stream-less adapters
    └── useAudio.ts               ← mic monitoring
```

---

## Contribution Guide

To contribute to package source code, raise PRs to the `main` branch.

---

## Sponsoring ❤️

**agentic-avatars is free, open-source, and maintained in personal time.**

If your product ships AI-powered conversations and this library saves you weeks of WebRTC wrangling, lip-sync work, and provider integration — consider sponsoring. Even a small recurring amount keeps the library maintained, more providers supported, and bugs fixed fast.

[**Sponsor on GitHub →**](https://github.com/sponsors/navodPeiris)

---

## Citing this project

If you use agentic-avatars in academic work, a research demo, or a published product, a citation or acknowledgement is appreciated.

**BibTeX**

```bibtex
@software{peiris2025agenticavatars,
  author  = {Peiris, Navod},
  title   = {agentic-avatars: Zero-Infrastructure Lip-Synced Gaussian-Splat avatar components for AI voice agents},
  year    = {2026},
  url     = {https://github.com/navodPeiris/agentic-avatars},
  note    = {npm: agentic-avatars}
}
```

**Plain text**

> Navod Peiris. _agentic-avatars: Zero-Infrastructure Lip-Synced Gaussian-Splat avatar components for AI voice agents._ 2026. https://github.com/navodPeiris/agentic-avatars

**Acknowledgement (for README or paper footnote)**

> Gaussian-splat avatar and lip-sync powered by [agentic-avatars](https://github.com/navodPeiris/agentic-avatars).
