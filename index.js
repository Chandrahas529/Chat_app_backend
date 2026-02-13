require("dotenv").config();
require("./dbConfig/config");
require("./cloudinaryConfig/cloudinaryConfig");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const admin = require("firebase-admin");

const userRoutes = require("./Routes/userRoutes");
const messageRoutes = require("./Routes/messageRoutes");

const authenticateWs = require("./Middleware/AuthenticateWs");
const handleCreateMessage = require("./WebSocketRoutes/CreateMessage");
const handleSendMedia = require("./WebSocketRoutes/SendMedia");
const userOnlineStatus = require("./WebSocketRoutes/UserOnlineStatus");
const userLastSeen = require("./WebSocketRoutes/UserLastSeen");
const handleMessageSeen = require("./WebSocketRoutes/SeenMessage");

admin.initializeApp({
  credential: admin.credential.cert(
    JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  )
});

const app = express();
const cors = require("cors");
const handleDeleteMessage = require("./WebSocketRoutes/DeleteMessage");
app.use(cors({
  origin: "*", // lock this down later
}));

app.use(express.json());

app.use("/user", userRoutes);
app.use("/message", messageRoutes);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
// 👇 GLOBAL HEARTBEAT CHECK
setInterval(() => {
  wss.clients.forEach(ws => {
    if (!ws.isAlive) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);


const onlineUsers = new Map();

wss.on("connection", (ws, request) => {
  let user;
  console.log("Request for connection ");

  try {
    user = authenticateWs(request);
  } catch (error) {
    console.log("WebSocket auth failed:", error.message);

    try {
      ws.send(JSON.stringify({
        type: "AUTH_ERROR",
        message: error.message
      }));
    } catch (_) {}
    ws.close(4001, error.message);
    return;
  }


  console.log("Client connected:");
  ws.isAlive = true;
  ws.on("pong", () => ws.isAlive = true);
  ws.userId = user.userId;
  onlineUsers.set(user.userId, ws);
  userOnlineStatus(user.userId);

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case "CREATE_MESSAGE":
          handleCreateMessage(ws, msg, onlineUsers);
          break;

        case "SEND_MEDIA":
          handleSendMedia(ws, msg, onlineUsers);
          break;

        case "MESSAGE_SEEN":
          handleMessageSeen(ws, msg, onlineUsers);
          break;

        case "DELETE_MESSAGE":
          handleDeleteMessage(ws, msg, onlineUsers);
          break;

        default:
          ws.send(JSON.stringify({
            type: "ERROR",
            message: "Unknown message type",
          }));
      }
    } catch (err) {
      ws.send(JSON.stringify({
        type: "ERROR",
        message: "Invalid message format",
      }));
    }
  });

  ws.on("close", () => {
    if (ws.userId) {
      userLastSeen(ws.userId);
      onlineUsers.delete(ws.userId);
    }
    console.log("WebSocket disconnected");
  });
});

const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log("Server started");
});
