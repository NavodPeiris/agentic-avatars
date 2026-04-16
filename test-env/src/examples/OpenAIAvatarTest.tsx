import { OpenAIAvatarAgent } from "agentic-avatars/openai";
import type { OpenAIRealtimeTool } from "agentic-avatars";
import { Jane } from "agentic-avatars";
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.REACT_APP_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true // ONLY FOR TESTING
});

const sys_prompt = `
# ROLE
You are a product recommendation assistant for Amazon who answers user questions and recommends products based on their preferences.
at initial greeting, say 'Hello! I am Jane, a product specialist at Amazon. I can help you find products — feel free to tell me what you are looking for!'
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

const tools: OpenAIRealtimeTool[] = [
  {
    name: 'get_product_price',
    description: 'Returns the current price of a product.',
    parameters: {
      type: 'object',
      properties: {
        product_name: { type: 'string', description: 'Name of the product' },
      },
      required: ['product_name'],
    },
    handler: ({ product_name }) => {
      const prices: Record<string, string> = {
        'apple iphone 15 pro max': '$1,199',
        'samsung galaxy s23 ultra': '$1,099',
        'sony wh-1000xm5': '$349',
        'dell xps 13': '$999',
        'amazon echo dot': '$49',
      };
      const price = prices[(product_name as string).toLowerCase()] ?? 'Price not available';
      return { product_name, price };
    },
  },
];

export default function OpenAIAvatarTest() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <OpenAIAvatarAgent
        backgroundImages={["/niceBG.jpg"]}
        avatarComponent={Jane}
        agentVoice="nova"
        tools={tools}
        getEphemeralKey={async () => {
          // YOU SHOULD NEVER CALL THE OPENAI API DIRECTLY FROM THE BROWSER IN PRODUCTION. INSTEAD PROXY THIS REQUEST THROUGH YOUR BACKEND SERVER TO KEEP YOUR API KEY SAFE.
          const session = await openai.realtime.clientSecrets.create({
            session: {
              type: 'realtime',
              model: 'gpt-realtime-mini-2025-10-06',
              instructions: sys_prompt,
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