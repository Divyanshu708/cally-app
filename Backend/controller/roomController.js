const Rooms = require("../model/roomModel");

module.exports.getAllRooms = async (req, res) => {
  const rooms = await Rooms.find();
  res.status(200).json({ data: rooms });
};

module.exports.createRoom = async (req, res) => {
  const { roomId, name, role } = req.body;
  const room = await Rooms.create({ roomId, name, role });
  res.status(201).json({ data: room, message: "Room created successfully" });
};

module.exports.getRoomById = async (req, res) => {
  const { id } = req.params;
  const room = await Rooms.findOne({ roomId: id });
  res.status(200).json({ data: room });
};

module.exports.deleteRoomById = async (req, res) => {
  const { id } = req.params;
  const room = await Rooms.findOneAndDelete({ roomId: id });
  res.status(200).json({
    data: { roomId: room.roomId, name: room.name },
    message: "Room deleted successfully",
  });
};
