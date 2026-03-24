import { useState, useEffect, useRef, useCallback } from "react";
import { socket } from "../services/socket";
import VideoControls from "../Ui/VideoControls";
import Whiteboard from "./Whiteboard";
import { useMediasoup } from "../hooks/useMediasoup";

function VideoChat({ roomId, participants = [], role, displayName }) {
  const [viewMode, setViewMode] = useState("focused");
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const localVideoRef = useRef(null);

  const {
    localStream,
    remoteTracks,
    mediaError,
    isReady,
    micOn,
    cameraOn,
    toggleMic,
    toggleCamera,
    setMicEnabled,
    setCameraEnabled,
  } = useMediasoup(roomId, displayName);

  const isAdmin = role === "admin";
  const adminParticipant =
    participants.find((p) => p.isAdmin) || participants[0];

  useEffect(() => {
    if (!roomId) return;
    const onWhiteboardToggle = ({ show }) => setShowWhiteboard(show);
    socket.on("whiteboard-toggle", onWhiteboardToggle);
    socket.emit("whiteboard-get-state", { roomId }, ({ show }) => {
      if (typeof show === "boolean") setShowWhiteboard(show);
    });
    return () => socket.off("whiteboard-toggle", onWhiteboardToggle);
  }, [roomId]);

  useEffect(() => {
    const el = localVideoRef.current;
    if (el && localStream) {
      el.srcObject = localStream;
      el.play().catch(() => {});
    }
  }, [localStream]);

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => (t.enabled = micOn));
      localStream.getVideoTracks().forEach((t) => (t.enabled = cameraOn));
    }
  }, [localStream, micOn, cameraOn]);

  const handleWhiteboardToggle = () => {
    if (!isAdmin) return;
    const next = !showWhiteboard;
    setShowWhiteboard(next);
    socket.emit("whiteboard-toggle", { roomId, show: next });
  };

  const renderVideoTile = (p, isLarge = false) => {
    const isLocal = p.id === socket.id;
    const remote = remoteTracks[p.id];
    const rawVideoTrack = isLocal
      ? localStream?.getVideoTracks()[0]
      : remote?.video;
    const videoTrack =
      rawVideoTrack?.readyState === "ended" ? null : rawVideoTrack;
    const hasVideo = isLocal ? cameraOn : !!videoTrack;
    const audioTrack = isLocal ? null : remote?.audio;

    return (
      <div
        key={p.id}
        className={`relative rounded-xl overflow-hidden bg-white/10 flex items-center justify-center ${
          isLarge
            ? "flex-1 min-h-[30dvh] lg:min-h-0"
            : `w-full aspect-square min-h-[120px]  ${viewMode === "grid" ? "h-[10rem] sm:h-[15rem]" : "h-[8rem] sm:h-[15rem]"} min-w-0 shrink-0`
        }`}
      >
        {videoTrack && hasVideo ? (
          <RemoteVideo
            videoTrack={videoTrack}
            audioTrack={audioTrack}
            isLocal={isLocal}
            videoRef={isLocal ? localVideoRef : null}
            localStream={isLocal ? localStream : null}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-white/5">
            <span className="text-4xl font-semibold text-white/60">
              {((isLocal
                ? displayName
                : remote?.displayName || p.displayName) ||
                "?")[0].toUpperCase()}
            </span>
          </div>
        )}
        <div className="absolute bottom-1 left-1 px-2 py-0.5 rounded bg-black/50 text-white text-xs">
          {isLocal
            ? displayName || "You"
            : remote?.displayName || p.displayName || "User"}
        </div>
        {p?.isAdmin && (
          <div className="absolute top-1 right-1 px-2 py-0.5 rounded-md bg-amber-400/90 text-black text-[10px] font-semibold">
            ADMIN
          </div>
        )}
      </div>
    );
  };

  const getOrderedParticipants = () => {
    const me = { id: socket.id, displayName, isAdmin: isAdmin };
    const admin = participants.find((p) => p.isAdmin) || participants[0];
    const rest = participants.filter(
      (p) => p.id !== admin?.id && p.id !== socket.id,
    );

    const byId = new Map();
    if (admin) byId.set(admin.id, { ...admin });
    byId.set(me.id, me);
    for (const p of rest) byId.set(p.id, { ...p });
    for (const [id, data] of Object.entries(remoteTracks)) {
      if (!byId.has(id))
        byId.set(id, { id, displayName: data.displayName || "User" });
    }

    const ordered = [];
    if (admin && admin.id !== me.id) ordered.push(byId.get(admin.id));
    ordered.push(me);
    for (const p of rest) {
      if (p.id !== me.id && p.id !== admin?.id) ordered.push(byId.get(p.id));
    }
    for (const id of Object.keys(remoteTracks)) {
      if (!ordered.some((o) => o?.id === id)) ordered.push(byId.get(id));
    }
    const seen = new Set();
    return ordered.filter(Boolean).filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });
  };

  const getFocusedLayout = () => {
    const ordered = getOrderedParticipants();
    if (ordered.length <= 1) {
      return (
        <div className="h-full min-h-0 flex">
          {renderVideoTile(ordered[0], true)}
        </div>
      );
    }
    const big = ordered[0];
    const small = ordered.slice(1);
    return (
      <div className="h-full min-h-0 flex flex-col sm:flex-row gap-3 overflow-hidden">
        <div className="flex-1 min-w-0 flex flex-col">
          {renderVideoTile(big, true)}
        </div>
        <div className="w-full sm:w-[35%] grid grid-cols-2 sm:grid-cols-1 auto-rows-max gap-2 overflow-auto scrollbar-hide content-start pr-1">
          {small.map((p) => renderVideoTile(p, false))}
        </div>
      </div>
    );
  };

  const getGridLayout = () => {
    const ordered = getOrderedParticipants();
    return (
      <div className="h-full sm:h-full min-h-0 grid grid-cols-2 sm:grid-cols-3 auto-rows-max gap-2 content-start overflow-y-auto sm:overflow-auto scrollbar-hide pr-1">
        {ordered.map((p) => renderVideoTile(p, false))}
      </div>
    );
  };

  const mainContent = showWhiteboard ? (
    <div className="h-full min-h-0 rounded-xl overflow-hidden">
      <Whiteboard roomId={roomId} canDraw={isAdmin} />
    </div>
  ) : viewMode === "grid" ? (
    getGridLayout()
  ) : (
    getFocusedLayout()
  );

  return (
    <div className="flex flex-col flex-1 min-w-0 h-full min-h-0 gap-3 bg-[#C9DFE6]/31 rounded-2xl p-2 sm:p-4 overflow-hidden">
      {showWhiteboard && <RemoteAudioSinks remoteTracks={remoteTracks} />}
      <div className="flex-1 min-h-0 overflow-hidden">{mainContent}</div>
      <VideoControls
        micOn={micOn}
        cameraOn={cameraOn}
        onMicToggle={toggleMic}
        onCameraToggle={toggleCamera}
        showWhiteboard={showWhiteboard}
        onWhiteboardToggle={handleWhiteboardToggle}
        viewMode={viewMode}
        onViewToggle={() =>
          setViewMode((v) => (v === "grid" ? "focused" : "grid"))
        }
        isAdmin={isAdmin}
      />
    </div>
  );
}

function RemoteAudioSinks({ remoteTracks }) {
  return (
    <div className="hidden" aria-hidden="true">
      {Object.entries(remoteTracks).map(([socketId, tracks]) =>
        tracks?.audio ? (
          <RemoteAudioSink key={socketId} audioTrack={tracks.audio} />
        ) : null
      )}
    </div>
  );
}

function RemoteAudioSink({ audioTrack }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioTrack) return undefined;
    const stream = new MediaStream([audioTrack]);
    el.srcObject = stream;
    el.playsInline = true;
    el.play().catch(() => {});
    return () => {
      el.srcObject = null;
    };
  }, [audioTrack]);

  return <audio ref={audioRef} autoPlay playsInline />;
}

function RemoteVideo({
  videoTrack,
  audioTrack,
  isLocal,
  videoRef,
  localStream,
}) {
  const videoEl = useRef(null);
  const audioEl = useRef(null);
  const videoTrackRef = useRef(null);
  const audioTrackRef = useRef(null);
  videoTrackRef.current = videoTrack;
  audioTrackRef.current = audioTrack;

  useEffect(() => {
    if (isLocal && localStream && videoRef?.current) {
      const el = videoRef.current;
      el.srcObject = localStream;
      el.play().catch(() => {});
    }
  }, [isLocal, localStream, videoRef]);

  useEffect(() => {
    if (isLocal && localStream) return;
    const el = videoRef?.current || videoEl.current;
    if (el && videoTrack) {
      const videoStream = new MediaStream([videoTrack]);
      el.srcObject = videoStream;
      el.muted = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.setAttribute("x-webkit-airplay", "deny");
      el.play().catch(() => {});

      const attemptPlay = () => el.play().catch(() => {});
      el.addEventListener("loadedmetadata", attemptPlay);
      el.addEventListener("loadeddata", attemptPlay);
      el.addEventListener("canplay", attemptPlay);
      el.addEventListener("canplaythrough", attemptPlay);
      const t1 = setTimeout(attemptPlay, 200);
      const t2 = setTimeout(attemptPlay, 600);

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        el.removeEventListener("loadedmetadata", attemptPlay);
        el.removeEventListener("loadeddata", attemptPlay);
        el.removeEventListener("canplay", attemptPlay);
        el.removeEventListener("canplaythrough", attemptPlay);
        el.srcObject = null;
      };
    }
  }, [videoTrack, videoRef, isLocal, localStream]);

  useEffect(() => {
    const el = audioEl.current;
    if (el && audioTrack && !isLocal) {
      const audioStream = new MediaStream([audioTrack]);
      el.srcObject = audioStream;
      el.playsInline = true;
      el.play().catch(() => {});
      return () => {
        el.srcObject = null;
      };
    }
  }, [audioTrack, isLocal]);

  const handleUserGesture = useCallback(() => {
    const vEl = videoRef?.current || videoEl.current;
    const aEl = audioEl.current;
    const vTrack = videoTrackRef.current;
    const aTrack = audioTrackRef.current;
    if (vEl && vTrack) {
      vEl.srcObject = new MediaStream([vTrack]);
      vEl.muted = true;
      vEl.playsInline = true;
      vEl.play();
    }
    if (aEl && aTrack) {
      aEl.srcObject = new MediaStream([aTrack]);
      aEl.play();
    }
  }, [videoRef]);

  if (isLocal) {
    return (
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
      />
    );
  }
  return (
    <div
      className="relative w-full h-full min-h-[100px]"
      onClick={handleUserGesture}
      onTouchEnd={handleUserGesture}
      style={{ touchAction: "manipulation" }}
    >
      <video
        ref={videoEl}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover"
        style={{ backgroundColor: "#1a1a2e" }}
      />
      {audioTrack && <audio ref={audioEl} autoPlay playsInline />}
    </div>
  );
}

export default VideoChat;
