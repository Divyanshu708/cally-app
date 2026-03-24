const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
  roomId: { type: String, required: true, unique: true },
  name: { type: String, default: "" },
  role: { type: String, enum: ["admin", "user"], required: true },
  createdAt: { type: Date, default: Date.now },
});

const Rooms = mongoose.model("Rooms", roomSchema);

module.exports = Rooms;
