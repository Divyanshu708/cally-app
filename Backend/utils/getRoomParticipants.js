function getRoomParticipants(io, roomId) {
  const room = io.sockets.adapter.rooms.get(roomId);
  if (!room) {
    console.log("Room not found");
    return [];
  }

  const participants = Array.from(room).map((socketId) => {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) {
      return null;
    }
    return {
      id: socketId,
      displayName: socket?.data?.displayName || "Unknown",
      isAdmin: socket?.data?.role === "admin",
    };
  });

  return participants.filter((participant) => participant !== null);
}

module.exports = getRoomParticipants;
