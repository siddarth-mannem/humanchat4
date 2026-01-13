/**
 * Call control buttons
 * Mute, Camera, Screen Share, PiP, End Call
 */

'use client';

import { Mic, MicOff, Video, VideoOff, Monitor, MonitorOff, PictureInPicture, PhoneOff } from 'lucide-react';

interface CallControlsProps {
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleScreenShare: () => void;
  onTogglePiP: () => void;
  onEndCall: () => void;
  showCamera?: boolean;
}

export default function CallControls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  onToggleMute,
  onToggleCamera,
  onToggleScreenShare,
  onTogglePiP,
  onEndCall,
  showCamera = true,
}: CallControlsProps) {
  return (
    <div className="flex items-center justify-center gap-4">
      {/* Mute */}
      <button
        onClick={onToggleMute}
        className={`p-4 rounded-full transition-colors ${
          isMuted
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-gray-700 hover:bg-gray-600'
        }`}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {isMuted ? (
          <MicOff size={24} className="text-white" />
        ) : (
          <Mic size={24} className="text-white" />
        )}
      </button>

      {/* Camera (video calls only) */}
      {showCamera && (
        <button
          onClick={onToggleCamera}
          className={`p-4 rounded-full transition-colors ${
            isCameraOff
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-gray-700 hover:bg-gray-600'
          }`}
          aria-label={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          {isCameraOff ? (
            <VideoOff size={24} className="text-white" />
          ) : (
            <Video size={24} className="text-white" />
          )}
        </button>
      )}

      {/* Screen Share */}
      <button
        onClick={onToggleScreenShare}
        className={`p-4 rounded-full transition-colors ${
          isScreenSharing
            ? 'bg-blue-600 hover:bg-blue-700'
            : 'bg-gray-700 hover:bg-gray-600'
        }`}
        aria-label={isScreenSharing ? 'Stop sharing' : 'Share screen'}
      >
        {isScreenSharing ? (
          <MonitorOff size={24} className="text-white" />
        ) : (
          <Monitor size={24} className="text-white" />
        )}
      </button>

      {/* Picture in Picture */}
      <button
        onClick={onTogglePiP}
        className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
        aria-label="Picture in picture"
      >
        <PictureInPicture size={24} className="text-white" />
      </button>

      {/* End Call */}
      <button
        onClick={onEndCall}
        className="p-4 rounded-full bg-red-600 hover:bg-red-700 transition-colors ml-4"
        aria-label="End call"
      >
        <PhoneOff size={24} className="text-white" />
      </button>
    </div>
  );
}
