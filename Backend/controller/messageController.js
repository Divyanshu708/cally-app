const Messages = require("../model/messageModel");

module.exports.getAllMessages = async (req, res) => {
  try {
    const { roomId } = req.query;

    const filter = {};
    if (roomId) filter.roomId = roomId;

    const messages = await Messages.find(filter).sort({ createdAt: 1 });

    res.status(200).json({
      status: "success",
      results: messages.length,
      data: messages,
    });
  } catch (err) {
    console.error("Error fetching messages", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch messages",
    });
  }
};

module.exports.createMessage = async (req, res) => {
  try {
    const { roomId, userId, userName, text } = req.body;

    if (!roomId || !userId || !text) {
      return res.status(400).json({
        status: "fail",
        message: "roomId, userId and text are required",
      });
    }

    const message = await Messages.create({
      roomId,
      userId,
      userName,
      text,
    });

    res.status(201).json({
      status: "success",
      data: message,
    });
  } catch (err) {
    console.error("Error creating message", err);
    res.status(500).json({
      status: "error",
      message: "Failed to create message",
    });
  }
};

module.exports.getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Messages.findById(id);

    if (!message) {
      return res.status(404).json({
        status: "fail",
        message: "Message not found",
      });
    }

    res.status(200).json({
      status: "success",
      data: message,
    });
  } catch (err) {
    console.error("Error fetching message by id", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch message",
    });
  }
};

module.exports.deleteMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await Messages.findByIdAndDelete(id);

    if (!message) {
      return res.status(404).json({
        status: "fail",
        message: "Message not found",
      });
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (err) {
    console.error("Error deleting message", err);
    res.status(500).json({
      status: "error",
      message: "Failed to delete message",
    });
  }
};
