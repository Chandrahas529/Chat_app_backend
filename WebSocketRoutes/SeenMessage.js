const Message = require("../Modals/Message");

async function handleMessageSeen(ws, msg, onlineUsers) {
  const { senderId } = msg.data; // the person who sent messages
  const receiverId = ws.userId;  // current logged-in user
  if (!senderId) {
    ws.send(JSON.stringify({
      type: "ERROR",
      message: "Invalid seen payload"
    }));
    return;
  }

  try {
    // 1️⃣ Update DB: mark messages as seen
    await Message.updateMany(
      {
        senderId: senderId,
        receiverId: receiverId,
        seenStatus: false
      },
      {
        $set: { seenStatus: true }
      }
    );

    // 2️⃣ Notify sender (if online)
    const senderSocket = onlineUsers.get(senderId);
    if (senderSocket) {
      senderSocket.send(JSON.stringify({
        type: "MESSAGES_SEEN",
        data: {
          receiverId
        }
      }));
    }

  } catch (err) {
    console.error("Message seen error:", err);
    ws.send(JSON.stringify({
      type: "ERROR",
      message: "Server error"
    }));
  }
}

module.exports = handleMessageSeen;
