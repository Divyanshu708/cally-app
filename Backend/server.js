const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, ".env") });
const app = require("./app");
const { createServer } = require("http");
const { Server } = require("socket.io");
const httpServer = createServer(app);
const mongoose = require("mongoose");
const getRoomParticipants = require("./utils/getRoomParticipants");
const Messages = require("./model/messageModel");
const Rooms = require("./model/roomModel");
const Room = require("./lib/Room");

const ROOM_EMPTY_CLEANUP_MS = 60 * 1000; // 1 minute
const roomCleanupTimers = new Map(); // roomId -> timeoutId
const mediasoupRooms = new Map(); // roomId -> Room
const whiteboardStrokes = new Map(); // roomId -> strokes[]
const whiteboardVisibility = new Map(); // roomId -> boolean
const roomAdmins = new Map(); // roomId -> admin displayName

function normalizeRoomId(roomId) {
  return roomId == null ? roomId : String(roomId);
}

async function getOrCreateMediasoupRoom(roomId) {
  const id = normalizeRoomId(roomId);
  let room = mediasoupRooms.get(id);
  if (!room) {
    room = new Room(id);
    await room.init();
    mediasoupRooms.set(id, room);
  }
  return room;
}

function cleanupMediasoupRoom(roomId) {
  const id = normalizeRoomId(roomId);
  const room = mediasoupRooms.get(id);
  if (room) {
    room.close();
    mediasoupRooms.delete(id);
  }
  whiteboardStrokes.delete(id);
  whiteboardVisibility.delete(id);
  roomAdmins.delete(id);
}

mongoose
  .connect(process.env.DB)
  .then(() => {
    console.log("Connected to MongoDB");
  })
  .catch((err) => {
    console.log("Error connecting to MongoDB", err);
  });

const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",
  "http://127.0.0.1:5173",
  "https://127.0.0.1:5173",
  "http://10.13.118.161:5173",
  "https://10.13.118.161:5173",
  process.env.FRONTEND_URL,
  "https://cally-app.netlify.app",
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return true;
  if (/^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/.test(origin)) return true;
  return false;
};

const io = new Server(httpServer, {
  cors: {
    // origin: (origin, cb) => cb(null, isAllowedOrigin(origin)),
    origin: (origin, cb) => {
  if (!origin || isAllowedOrigin(origin)) {
    return cb(null, true);
  }
  return cb(new Error("Not allowed by CORS"));
},
    methods: ["GET", "POST"],
  },
});

function scheduleEmptyRoomCleanup(ioInstance, roomId) {
  const id = normalizeRoomId(roomId);
  const existingTimer = roomCleanupTimers.get(id);
  if (existingTimer) clearTimeout(existingTimer);
  const timerId = setTimeout(async () => {
    roomCleanupTimers.delete(id);
    cleanupMediasoupRoom(id);
    try {
      if (getRoomParticipants(ioInstance, id).length === 0) {
        await Rooms.deleteOne({ roomId: id });
        await Messages.deleteMany({ roomId: id });
        console.log("Cleaned up empty room:", id);
      }
    } catch (err) {
      console.error("Error cleaning up room", id, err);
    }
  }, ROOM_EMPTY_CLEANUP_MS);
  roomCleanupTimers.set(id, timerId);
}

function broadcastRoomParticipants(ioInstance, roomId) {
  const id = normalizeRoomId(roomId);
  const participants = getRoomParticipants(ioInstance, id);
  ioInstance.to(id).emit("room-participants", participants);
  if (participants.length === 0) {
    scheduleEmptyRoomCleanup(ioInstance, id);
  }
}

io.on("connection", (socket) => {
  console.log("client connect", socket.id);

  socket.on("join-room", ({ roomId, roomName, displayName, role }) => {
    const id = normalizeRoomId(roomId);
    const existingTimer = roomCleanupTimers.get(id);
    if (existingTimer) {
      clearTimeout(existingTimer);
      roomCleanupTimers.delete(id);
    }

    // Leave any other mediasoup/chat rooms so one client cannot sit in two rooms
    // (avoids duplicate participants / duplicate remote video tiles after navigation or reload).
    for (const joined of socket.rooms) {
      if (joined === socket.id) continue;
      if (joined === roomId || joined === id) continue;
      const joinedKey = normalizeRoomId(joined);
      const oldRoom = mediasoupRooms.get(joinedKey);
      if (oldRoom) oldRoom.removePeer(socket.id);
      socket.leave(joined);
      broadcastRoomParticipants(io, joinedKey);
    }

    const requestedRole = role || "user";
    const savedAdminName = roomAdmins.get(id);
    const isSavedAdmin = !!savedAdminName && savedAdminName === displayName;
    let effectiveRole = requestedRole;

    // Remember first explicit admin for the room, and restore admin authority
    // on rejoin by matching displayName.
    if (!savedAdminName && requestedRole === "admin" && displayName) {
      roomAdmins.set(id, displayName);
      effectiveRole = "admin";
    } else if (isSavedAdmin) {
      effectiveRole = "admin";
    }

    socket.data.roomId = id;
    socket.data.roomName = roomName;
    socket.data.displayName = displayName;
    socket.data.role = effectiveRole;

    console.log("socket rooms", socket.rooms);

    socket.join(id);
    socket.emit("whiteboard-toggle", {
      show: whiteboardVisibility.get(id) === true,
    });
    socket.to(id).emit("user-joined", {
      userId: socket.id,
      roomName,
      displayName,
    });

    const mroom = mediasoupRooms.get(id);
    const adapterRoom = io.sockets.adapter.rooms.get(id);
    if (mroom && adapterRoom) {
      mroom.pruneStalePeers(adapterRoom);
    }

    broadcastRoomParticipants(io, id);
    console.log("room participants", getRoomParticipants(io, id));
  });

  socket.on("getRouterRtpCapabilities", async ({ roomId }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      const rtpCapabilities = room.getRouterRtpCapabilities();
      cb({ rtpCapabilities });
    } catch (err) {
      console.error("getRouterRtpCapabilities", err);
      cb({ error: err.message });
    }
  });

  socket.on("createWebRtcTransport", async ({ roomId, direction }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      const transportOptions = await room.createWebRtcTransport(socket.id, direction);
      cb({ transportOptions });
    } catch (err) {
      console.error("createWebRtcTransport", err);
      cb({ error: err.message });
    }
  });

  socket.on("connectWebRtcTransport", async ({ roomId, transportId, dtlsParameters }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      await room.connectWebRtcTransport(socket.id, transportId, dtlsParameters);
      cb({});
    } catch (err) {
      console.error("connectWebRtcTransport", err);
      cb({ error: err.message });
    }
  });

  socket.on("produce", async ({ roomId, transportId, kind, rtpParameters }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      const { id } = await room.produce(socket.id, transportId, kind, rtpParameters);
      console.log("[produce]", {
        roomId: normalizeRoomId(roomId),
        socketId: socket.id,
        kind,
        producerId: id,
      });
      cb({ producerId: id });
      socket.to(roomId).emit("newProducer", {
        producerId: id,
        kind,
        socketId: socket.id,
        displayName: socket.data.displayName,
      });
    } catch (err) {
      console.error("produce", err);
      cb({ error: err.message });
    }
  });

  socket.on("consume", async ({ roomId, producerId, rtpCapabilities }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      const consumerParams = await room.consume(socket.id, producerId, rtpCapabilities);
      console.log("[consume:ok]", {
        roomId: normalizeRoomId(roomId),
        socketId: socket.id,
        producerId,
        kind: consumerParams?.kind,
        consumerId: consumerParams?.id,
      });
      cb({ consumerParams });
    } catch (err) {
      console.error("[consume:fail]", {
        roomId: normalizeRoomId(roomId),
        socketId: socket.id,
        producerId,
        error: err?.message,
      });
      cb({ error: err.message });
    }
  });

  socket.on("getProducers", async ({ roomId }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      const id = normalizeRoomId(roomId);
      const adapterRoom = io.sockets.adapter.rooms.get(id);
      if (adapterRoom) {
        room.pruneStalePeers(adapterRoom);
      }
      const getDisplayName = (sid) => {
        const s = io.sockets.sockets.get(sid);
        return s?.data?.displayName || "User";
      };
      const producers = room.getProducersForPeer(socket.id, getDisplayName);
      console.log("[getProducers]", {
        roomId: id,
        requester: socket.id,
        count: producers.length,
        kinds: producers.map((p) => p.kind),
      });
      cb({ producers });
    } catch (err) {
      console.error("getProducers", err);
      cb({ error: err.message, producers: [] });
    }
  });

  socket.on("producerPause", async ({ roomId, producerId }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      await room.pauseProducer(socket.id, producerId);
      if (typeof cb === "function") cb({});
      socket.to(roomId).emit("producerPaused", { producerId, socketId: socket.id });
    } catch (err) {
      console.error("producerPause", err);
      if (typeof cb === "function") cb({ error: err.message });
    }
  });

  socket.on("producerResume", async ({ roomId, producerId }, cb) => {
    try {
      const room = await getOrCreateMediasoupRoom(roomId);
      await room.resumeProducer(socket.id, producerId);
      if (typeof cb === "function") cb({});
      socket.to(roomId).emit("producerResumed", { producerId, socketId: socket.id });
    } catch (err) {
      console.error("producerResume", err);
      if (typeof cb === "function") cb({ error: err.message });
    }
  });

  socket.on("leave-room", async ({ roomId }) => {
    if (!roomId) return;
    const id = normalizeRoomId(roomId);
    const room = mediasoupRooms.get(id);
    if (room) room.removePeer(socket.id);
    socket.leave(id);
    socket.data.roomId = null;
    io.to(id).emit("user-left", { userId: socket.id });
    broadcastRoomParticipants(io, id);
  });

  socket.on("whiteboard-toggle", ({ roomId, show }) => {
    if (socket.data.role !== "admin" || !roomId) return;
    const id = normalizeRoomId(roomId);
    whiteboardVisibility.set(id, !!show);
    io.to(id).emit("whiteboard-toggle", { show: !!show });
  });

  socket.on("whiteboard-stroke", ({ roomId, points, strokeStyle, lineWidth }) => {
    if (socket.data.role !== "admin" || !roomId) return;
    const strokes = whiteboardStrokes.get(roomId) || [];
    strokes.push({ points, strokeStyle, lineWidth });
    whiteboardStrokes.set(roomId, strokes);
    socket.to(roomId).emit("whiteboard-stroke", { points, strokeStyle, lineWidth });
  });

  socket.on("whiteboard-clear", ({ roomId }) => {
    if (socket.data.role !== "admin" || !roomId) return;
    whiteboardStrokes.set(roomId, []);
    io.to(roomId).emit("whiteboard-clear");
  });

  socket.on("whiteboard-get-state", ({ roomId }, cb) => {
    if (!roomId) return cb({ strokes: [], show: false });
    const id = normalizeRoomId(roomId);
    const strokes = whiteboardStrokes.get(id) || [];
    const show = whiteboardVisibility.get(id) === true;
    cb({ strokes, show });
  });

  socket.on("send-message", async ({ roomId, userId, userName, text, clientTempId }) => {
    try {
      if (!roomId || !userId || !text) {
        return;
      }

      const message = await Messages.create({
        roomId,
        userId,
        userName: userName || "",
        text,
      });

      const msgPayload = {
        _id: message._id.toString(),
        roomId: message.roomId,
        userId: message.userId,
        userName: message.userName || "",
        text: message.text,
        createdAt: message.createdAt,
        clientTempId: clientTempId || null,
      };
      io.to(roomId).emit("message", msgPayload);
    } catch (err) {
      console.error("Error handling send-message", err);
    }
  });

  // Fires while the socket is still in its rooms — reliable cleanup on refresh / killed tab.
  socket.on("disconnecting", () => {
    for (const rid of socket.rooms) {
      if (rid === socket.id) continue;
      const id = normalizeRoomId(rid);
      const mroom = mediasoupRooms.get(id);
      if (mroom) mroom.removePeer(socket.id);
      io.to(rid).emit("user-left", { userId: socket.id });
      broadcastRoomParticipants(io, id);
    }
    socket.data.roomId = null;
  });

  socket.on("disconnect", (reason) => {
    console.log("client disconnected:", socket.id, reason || "");
  });
});

const PORT = process.env.PORT;
const mediasoupConfig = require("./config/mediasoupConfig");
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("Server Running on port:", PORT);
  const announced = mediasoupConfig.announcedIp;
  if (announced) {
    console.log("WebRTC IP:", announced, "| Mobile: https://" + announced + ":5173");
  } else {
    console.warn("Add MEDIASOUP_ANNOUNCED_IP=<your-PC-IP> to Backend/.env for mobile video");
  }
});
