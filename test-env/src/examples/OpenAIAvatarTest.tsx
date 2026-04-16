import { OpenAIAvatarAgent } from "agentic-avatars";
import { Jane } from "agentic-avatars";

export default function OpenAIAvatarTest() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <OpenAIAvatarAgent
        systemPrompt="You are a helpful assistant who answer user questions"
        backgroundImages={["/niceBG.jpg"]}
        avatarComponent={Jane}
        getEphemeralKey={async () => {
          // YOU SHOULD NEVER CALL THE OPENAI API DIRECTLY FROM THE BROWSER IN PRODUCTION. INSTEAD PROXY THIS REQUEST THROUGH YOUR BACKEND SERVER TO KEEP YOUR API KEY SAFE.
          const res = await fetch(
            'https://api.openai.com/v1/realtime/sessions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: 'gpt-realtime-mini-2025-10-06',
              }),
            },
          );
          const { client_secret } = await res.json();
          return client_secret.value;
        }}
        onSessionEnd={() => alert("Session ended")}
        sessionTimeout={2 * 60 * 1000}
      />
    </div>
  );
}