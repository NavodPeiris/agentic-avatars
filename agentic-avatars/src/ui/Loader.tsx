import { Html } from '@react-three/drei';

/** Spinner shown inside the Canvas while the avatar model is loading. */
export function Loader() {
  return (
    <Html center>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '4px solid #9ca3af',
            borderTopColor: 'white',
            animation: 'avatar-agent-spin 1s linear infinite',
          }}
        />
        <style>{`@keyframes avatar-agent-spin { to { transform: rotate(360deg); } }`}</style>
        <span style={{ color: 'white', fontSize: 18, fontWeight: 500 }}>Loading…</span>
      </div>
    </Html>
  );
}
