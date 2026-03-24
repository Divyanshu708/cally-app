import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import ConferencePage from "./ConferencePage";
import checkInputs from "../utils/checkInput";

function RoomEntryPage() {
  const { roomId } = useParams();
  const [showRoom, setShowRoom] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("roomInfo");
      const parsed = stored ? JSON.parse(stored) : null;
      if (parsed && parsed.roomId === roomId) {
        setShowRoom(true);
      }
    } catch {
      // invalid sessionStorage
    }
    setIsChecking(false);
  }, [roomId]);

  const handleJoin = async () => {
    if (!checkInputs(displayName.trim(), "Display name is required")) return;

    try {
      const res = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/rooms/${roomId}`,
      );
      const room = res.data.data;

      if (!room) {
        toast.error("Room not found");
        return;
      }

      sessionStorage.setItem(
        "roomInfo",
        JSON.stringify({
          roomId,
          roomInput: room.name || "Room",
          displayName: displayName.trim(),
          role: "user",
          roomCreatedAt: room.createdAt || new Date().toISOString(),
        }),
      );
      setShowRoom(true);
    } catch (err) {
      toast.error("Room not found");
    }
  };

  if (isChecking) {
    return (
      <div className="w-full h-full flex justify-center items-center text-white/60">
        Loading...
      </div>
    );
  }

  if (showRoom) {
    return <ConferencePage />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4 bg-[#16191F]/95 rounded-2xl border border-white/10 p-8 shadow-xl">
        <h2 className="text-xl font-semibold text-white/90 mb-2">
          Join Room
        </h2>
        <p className="text-sm text-white/60 mb-6">
          Enter your display name to join this room
        </p>
        <input
          type="text"
          placeholder="Display Name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          className="w-full h-12 rounded-lg px-4 border-2 border-white/30 bg-white/5 text-white placeholder:text-white/40 outline-none focus:border-white/50 mb-6"
        />
        <button
          onClick={handleJoin}
          className="w-full h-12 rounded-lg bg-white/15 hover:bg-white/25 border border-white/20 text-white font-medium transition-colors"
        >
          Join Room
        </button>
      </div>
    </div>
  );
}

export default RoomEntryPage;
