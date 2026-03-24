const express = require("express");
const router = express.Router();
const {
  getAllMessages,
  createMessage,
  getMessageById,
  deleteMessageById,
} = require("../controller/messageController.js");
router.route("/").get(getAllMessages).post(createMessage);
router.route("/:id").get(getMessageById).delete(deleteMessageById);
module.exports = router;
