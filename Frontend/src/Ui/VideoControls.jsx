import MicLogo from "../assets/Tools/Mic_Logo.svg";
import micCutLogo from "../assets/Tools/mic_cut_logo.svg";
import cameraLogo from "../assets/Tools/camera_logo.svg";
import cameraCutLogo from "../assets/Tools/camera_cut_logo.svg";
import whiteboardLogo from "../assets/Tools/whiteboard_Logo.svg";

function VideoControls({
  micOn,
  cameraOn,
  onMicToggle,
  onCameraToggle,
  showWhiteboard,
  onWhiteboardToggle,
  viewMode,
  onViewToggle,
  isAdmin = false,
}) {
  return (
    <div className="flex items-center gap-2 py-2">
      <button
        onClick={onMicToggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          micOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500/40 hover:bg-red-500/50"
        }`}
        title={micOn ? "Mute microphone" : "Unmute microphone"}
      >
        <img src={micOn ? MicLogo : micCutLogo} alt="Mic" className="w-5 h-5" />
      </button>
      <button
        onClick={onCameraToggle}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          cameraOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500/40 hover:bg-red-500/50"
        }`}
        title={cameraOn ? "Turn off camera" : "Turn on camera"}
      >
        <img src={cameraOn ? cameraLogo : cameraCutLogo} alt="Camera" className="w-5 h-5" />
      </button>
      {isAdmin && (
        <button
          onClick={onWhiteboardToggle}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
            showWhiteboard ? "bg-white/30" : "bg-white/20 hover:bg-white/30"
          }`}
          title={showWhiteboard ? "Switch to camera" : "Switch to whiteboard"}
        >
          <img src={whiteboardLogo} alt="Whiteboard" className="w-5 h-5" />
        </button>
      )}
      <button
        onClick={onViewToggle}
        className="px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white/80 text-xs font-medium transition-colors"
        title={viewMode === "grid" ? "Focused view" : "Grid view"}
      >
        {viewMode === "grid" ? "Focused" : "Grid"}
      </button>
    </div>
  );
}

export default VideoControls;
