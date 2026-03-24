import userMiniLogo from "../assets/miniUserLogo.svg";

function formatRoomDate(roomCreatedAt) {
  if (!roomCreatedAt) return new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return new Date(roomCreatedAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function RoomInfo({ roomName, participantCount = 0, roomCreatedAt }) {
  return (
    <div className="flex flex-col gap-0 px-2 sm:pl-4 lg:pl-20 text-white/70">
      <h1 className="text-lg sm:text-xl lg:text-2xl break-words">{roomName}</h1>
      <div className="font-light flex flex-wrap items-center gap-1.5 text-xs sm:text-sm">
        <img src={userMiniLogo} alt="User Mini Logo" className="scale-130" />{" "}
        <span>{participantCount} {participantCount === 1 ? "Person" : "People"}</span>
        <span>|</span>
        <span>{formatRoomDate(roomCreatedAt)}</span>
      </div>
    </div>
  );
}

export default RoomInfo;
