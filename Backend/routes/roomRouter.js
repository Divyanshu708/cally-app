const express = require("express");
const router = express.Router();
const {
  getAllRooms,
  createRoom,
  getRoomById,
  deleteRoomById,
} = require("../controller/roomController");
router.route("/").get(getAllRooms).post(createRoom);
router.route("/:id").get(getRoomById).delete(deleteRoomById);

module.exports = router;
