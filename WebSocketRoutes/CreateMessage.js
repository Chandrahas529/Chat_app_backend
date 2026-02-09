const Message = require("../Modals/Message");
const User = require("../Modals/User");
const admin = require("firebase-admin"); // Ensure initialized

async function handleCreateMessage(ws, msg, onlineUsers) {
  const { receiverId, messageType, messageText } = msg;
  const senderId = ws.userId;

  if (!receiverId || !messageType) {
    ws.send(JSON.stringify({ type: "ERROR", message: "Invalid input" }));
    return;
  }

  try {
    // 1️⃣ Save message in DB
    const saved = await Message.create({
      senderId,
      receiverId,
      messageType,
      messageText,
    });

    const mappedMessage = {
      _id: saved._id.toString(),
      senderId,
      receiverId,
      messageType: saved.messageType,
      messageText: saved.messageText || null,
      messageUrl:
        saved.messageType !== "text"
          ? {
            senderUrl: saved.messageUrl?.senderUrl || null,
            receiverUrl: saved.messageUrl?.receiverUrl || null,
            networkUrl: saved.messageUrl?.networkUrl || null,
          }
          : null,
      seenStatus: saved.seenStatus || false,
      messageAt: saved.createdAt,
      itsMe: true,
    };

    // 2️⃣ Send real-time to sender
    ws.send(JSON.stringify({ type: "NEW_MESSAGE", data: mappedMessage }));

    // 3️⃣ Send real-time to receiver if online
    const receiverSocket = onlineUsers.get(receiverId);
    if (receiverSocket) {
      receiverSocket.send(
        JSON.stringify({ type: "NEW_MESSAGE", data: { ...mappedMessage, itsMe: false } })
      );
    }
    // 4️⃣ Receiver offline → send FCM
    const [receiver, sender] = await Promise.all([
      User.findById(receiverId),
      User.findById(senderId),
    ]);

    if (receiver?.deviceToken) {
      await admin.messaging().send({
        token: receiver.deviceToken,
        notification: {
          title: sender.mobile.toString(),
          body:
            messageType === "text"
              ? messageText
              : "📎 New attachment",
        },
        data: {
          senderId: senderId.toString(),
          senderProfile: sender.profileImage?.toString() || "",
          senderPhone: sender.mobile.toString(),
          messageId: saved._id.toString(),
          messageType,
          messageText: messageText || "",
        },
        android: {
          priority: "high",
        },
      });
    }
  } catch (err) {
    console.error("Create message error:", err);
    ws.send(JSON.stringify({ type: "ERROR", message: "Server error" }));
  }
}

module.exports = handleCreateMessage;
