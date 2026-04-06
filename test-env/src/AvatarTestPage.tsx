import { AvatarAgent } from "agentic-avatars";

export default function AvatarTestPage() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <AvatarAgent
        systemPrompt="You are a helpful assistant who answer user questions"
        backgroundImages={["/niceBG.jpg"]}
        getEphemeralKey={async () => {
          const res = await fetch(
            'https://api.openai.com/v1/realtime/sessions',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
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