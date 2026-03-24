const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  roomId: { type: String, required: true },
  userId: { type: String, required: true },
  userName: { type: String, default: "" },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

// Optional: index for fast queries by room
messageSchema.index({ roomId: 1, createdAt: 1 });

const Messages = mongoose.model("Messages", messageSchema);

module.exports = Messages;
