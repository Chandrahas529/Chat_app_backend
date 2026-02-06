const Message = require("../Modals/Message");

async function handleSendMedia(ws, msg, onlineUsers) {
  const { receiverId, messageType } = msg;
  const senderId = ws.userId;

  if (!messageType) {
    ws.send(JSON.stringify({
      type: "ERROR",
      message: "Invalid media message"
    }));
    return;
  }

  try {
    const baseMessage = {
      _id: msg._id,
      senderId,
      receiverId,
      messageType,
      messageText: msg.messageText || null,
      messageUrl: msg.messageUrl || null,
      seenStatus: msg.seenStatus || false,
      messageAt: msg.createdAt || new Date()
    };

    // ✅ 1️⃣ Send to sender
    ws.send(JSON.stringify({
      type: "NEW_MESSAGE",
      data: { ...baseMessage, itsMe: true }
    }));

    // ✅ 2️⃣ Send to receiver
    const receiverSocket = onlineUsers.get(receiverId.toString());
    if (receiverSocket) {
      receiverSocket.send(JSON.stringify({
        type: "NEW_MESSAGE",
        data: { ...baseMessage, itsMe: false }
      }));
    }

  } catch (err) {
    console.error("WebSocket send media error:", err);
    ws.send(JSON.stringify({
      type: "ERROR",
      message: "Server error"
    }));
  }
}

module.exports = handleSendMedia;
