import { VapiAvatarAgent } from "agentic-avatars/vapi";
import { Jane } from "agentic-avatars";

export default function VapiAvatarTest() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <VapiAvatarAgent
        avatarComponent={Jane}
        // REMEMBER TO RESTRICT DOMAIN ON VAPI DASHBOARD TO AVOID KEY ABUSE
        publicKey={process.env.REACT_APP_VAPI_PUBLIC_KEY!}
        assistantId="18b60cb3-af7b-4247-8294-eb9d735d90e6"
        backgroundImages={["/niceBG.jpg"]}
        onSessionEnd={() => alert("Session ended")}
        sessionTimeout={2 * 60 * 1000}
      />
    </div>
  );
}