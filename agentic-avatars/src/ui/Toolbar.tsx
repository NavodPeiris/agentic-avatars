import { MicIcon, MicOffIcon } from '../icons';
import { AudioBars } from './AudioBars';
import type { SessionStatus } from '../types';

interface ToolbarProps {
  sessionStatus: SessionStatus;
  onToggleConnection: () => void;
  onToggleMute: () => void;
  isMuted: boolean;
  getMicLevel: () => number;
  getAgentLevel: () => number;
}

export function Toolbar({
  sessionStatus,
  onToggleConnection,
  onToggleMute,
  isMuted,
  getMicLevel,
  getAgentLevel,
}: ToolbarProps) {
  const isConnected = sessionStatus === 'CONNECTED';
  const isConnecting = sessionStatus === 'CONNECTING';
  const btnLabel = isConnected ? 'End' : isConnecting ? 'Starting…' : 'Start';

  return (
    <div style={{
      position: 'absolute',
      bottom: 20,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 10,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(8px)',
      borderRadius: 999,
      padding: '10px 20px',
      boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    }}>

      {isConnected && (
        <>
          {/* Mute button */}
          <button
            onClick={onToggleMute}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
            style={{
              background: isMuted ? 'rgba(255,255,255,0.15)' : 'transparent',
              border: 'none',
              borderRadius: '50%',
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
              transition: 'background 0.2s',
            }}
          >
            {isMuted ? <MicOffIcon /> : <MicIcon />}
          </button>

          {/* Audio bars */}
          <AudioBars
            getMicLevel={getMicLevel}
            getAgentLevel={getAgentLevel}
            isActive={!isMuted}
          />

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.2)' }} />
        </>
      )}

      {/* Connect / End button */}
      <button
        onClick={onToggleConnection}
        disabled={isConnecting}
        style={{
          background: isConnected ? '#dc2626' : '#ffffff',
          color: isConnected ? 'white' : '#000000',
          border: 'none',
          borderRadius: 999,
          padding: '7px 22px',
          fontSize: 14,
          fontWeight: 600,
          cursor: isConnecting ? 'not-allowed' : 'pointer',
          opacity: isConnecting ? 0.6 : 1,
          transition: 'background 0.2s, opacity 0.2s',
          whiteSpace: 'nowrap',
        }}
      >
        {btnLabel}
      </button>
    </div>
  );
}
