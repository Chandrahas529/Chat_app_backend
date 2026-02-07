const Message = require("../Modals/Message");
const User = require("../Modals/User");
const admin = require("firebase-admin");


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

    const receiverSocket = onlineUsers.get(receiverId.toString());

if (receiverSocket) {
  // ✅ Receiver online → real-time
  receiverSocket.send(JSON.stringify({
    type: "NEW_MESSAGE",
    data: { ...baseMessage, itsMe: false }
  }));
} else {
  // 🔔 Receiver offline → FCM notification
  const [receiver, sender] = await Promise.all([
    User.findById(receiverId),
    User.findById(senderId),
  ]);

  if (receiver?.deviceToken) {
    await admin.messaging().send({
      token: receiver.deviceToken,
      data: {
        senderId: senderId.toString(),
        senderProfile: sender.profileImage?.toString() || "",
        senderPhone: sender.mobile?.toString() || "",
        messageId: msg._id.toString(),
        messageType,
        messageText: msg.messageText || "", // media usually empty
      },
      android: {
        priority: "high",
      },
    });
  }
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
