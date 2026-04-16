import { DeepgramAvatarAgent } from "agentic-avatars/deepgram";
import { Jane } from "agentic-avatars";

export default function DeepgramAvatarTest() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <DeepgramAvatarAgent
        avatarComponent={Jane}
        // YOU SHOULD NEVER EXPOSE YOUR DEEPGRAM API KEY IN THE BROWSER IN PRODUCTION.
        // FOR PRODUCTION USE: proxy the key through your backend.
        getApiKey={async () => process.env.REACT_APP_DEEPGRAM_API_KEY!}
        systemPrompt="You are a helpful assistant. Keep your answers short and conversational."
        llm={{ provider: "open_ai", model: "gpt-4o-mini" }}
        voice="aura-2-thalia-en"
        sttModel="nova-3"
        backgroundImages={["/niceBG.jpg"]}
        onSessionEnd={() => alert("Session ended")}
        sessionTimeout={2 * 60 * 1000}
      />
    </div>
  );
}
