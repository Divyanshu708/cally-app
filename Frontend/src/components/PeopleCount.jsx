const AVATAR_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#06b6d4", "#22c55e", "#f97316", "#0ea5e9",
  "#a855f7", "#e11d48", "#10b981", "#eab308", "#3b82f6",
];

function getAvatarColor(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index];
}

function PeopleCount({ participants = [] }) {
  return (
    <div className="w-14 sm:w-16 lg:w-22 h-auto bg-[#C9DFE6]/31 rounded-2xl py-2 px-1 sm:px-2 overflow-y-auto scrollbar-hide shrink-0">
      <div className="flex flex-col gap-2">
        {participants.map((p) => {
          const letter = (p.displayName || "?")[0].toUpperCase();
          const bgColor = getAvatarColor(p.id);
          return (
            <div
              key={p.id}
              className="w-10 h-10 sm:w-11 sm:h-11 lg:w-[3.2rem] lg:h-[3.2rem] rounded-full flex items-center justify-center text-white font-semibold text-base sm:text-lg lg:text-xl shrink-0"
              style={{ backgroundColor: bgColor }}
              title={p.displayName}
            >
              {letter}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PeopleCount;
