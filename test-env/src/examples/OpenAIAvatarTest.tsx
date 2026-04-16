import { OpenAIAvatarAgent } from "agentic-avatars/openai";
import { Jane } from "agentic-avatars";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // ONLY FOR TESTING
});

export default function OpenAIAvatarTest() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <OpenAIAvatarAgent
        systemPrompt="You are a helpful assistant who answer user questions"
        backgroundImages={["/niceBG.jpg"]}
        avatarComponent={Jane}
        getEphemeralKey={async () => {
          // YOU SHOULD NEVER CALL THE OPENAI API DIRECTLY FROM THE BROWSER IN PRODUCTION. INSTEAD PROXY THIS REQUEST THROUGH YOUR BACKEND SERVER TO KEEP YOUR API KEY SAFE.
          const session = await openai.realtime.clientSecrets.create({
            session: {
              type: 'realtime',
              model: 'gpt-realtime-mini-2025-10-06',
            },
          });
          return session.value;
        }}
        onSessionEnd={() => alert("Session ended")}
        sessionTimeout={2 * 60 * 1000}
      />
    </div>
  );
}