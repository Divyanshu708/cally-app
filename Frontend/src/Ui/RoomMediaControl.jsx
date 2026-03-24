import { useState, useEffect } from "react";

function formatElapsed(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");
}

function RoomMediaControl({ onLeaveRoom, roomCreatedAt }) {
  const [elapsed, setElapsed] = useState("00:00:00");

  useEffect(() => {
    const start = roomCreatedAt ? new Date(roomCreatedAt).getTime() : Date.now();
    const update = () => {
      setElapsed(formatElapsed(Date.now() - start));
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [roomCreatedAt]);

  return (
    <div className="flex w-full sm:w-auto gap-2 sm:gap-4 px-2 sm:pr-6 items-center justify-between sm:justify-end">
      <div className="h-10 sm:h-12 px-3 sm:px-5 bg-gray-100/12 rounded-full flex items-center justify-center gap-2">
        <svg
          className="w-5 h-5 text-white/60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-white/60 text-sm sm:text-lg font-light">{elapsed}</span>
      </div>
      <button
        onClick={onLeaveRoom}
        className="px-3 sm:px-5 py-2 sm:py-2.5 rounded-full bg-red-500/30 hover:bg-red-500/50 border border-red-500/50 text-red-200 font-medium text-xs sm:text-sm transition-colors hvrScl"
      >
        Leave Room
      </button>
    </div>
  );
}

export default RoomMediaControl;
