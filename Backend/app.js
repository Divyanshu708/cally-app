require("dotenv").config();
const express = require("express");
const roomRouter = require("./routes/roomRouter");
const messageRouter = require("./routes/messageRouter");
const app = express();
const cors = require("cors");
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

const allowedOrigins = [
  "http://localhost:5173",
  "https://localhost:5173",
  "http://10.13.118.161:5173",
  "https://10.13.118.161:5173",
  process.env.FRONTEND_URL,
  "https://cally-app.netlify.app",
];

console.log(process.env.FRONTEND_URL);

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/api/rooms", roomRouter);
app.use("/api/messages", messageRouter);

module.exports = app;
