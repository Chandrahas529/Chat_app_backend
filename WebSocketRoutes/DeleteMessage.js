const Message = require("../Modals/Message");
const cloudinary = require("cloudinary").v2;

async function handleDeleteMessage(ws, data, onlineUsers) {
  const { deleteList } = data;
  // 1️⃣ Validate input
  if (!deleteList || !Array.isArray(deleteList) || deleteList.length === 0) {
    ws.send(JSON.stringify({
      type: "ERROR",
      message: "No ids provided"
    }));
    return;
  }

  try {
    // 2️⃣ Find messages from DB
    const messages = await Message.find({
      _id: { $in: deleteList }
    });

    if (!messages.length) {
      ws.send(JSON.stringify({
        type: "ERROR",
        message: "No messages found"
      }));
      return;
    }

    // 3️⃣ Collect users involved (sender + receiver)
    const usersToNotify = new Set();

    for (const msg of messages) {

      usersToNotify.add(msg.senderId.toString());
      usersToNotify.add(msg.receiverId.toString());

      // 4️⃣ Delete media from Cloudinary if needed
      if (msg.messageType === "image" || msg.messageType === "video") {
        const urls = [
          msg.messageUrl?.senderUrl,
          msg.messageUrl?.receiverUrl,
          msg.messageUrl?.networkUrl,
        ].filter(Boolean);

        for (const url of urls) {
          try {
            const parts = url.split("/");
            const folderIndex = parts.findIndex(p => p === "vaarta_app");

            if (folderIndex !== -1) {
              const publicId = parts
                .slice(folderIndex)
                .join("/")
                .replace(/\.[^/.]+$/, "");

              await cloudinary.uploader.destroy(publicId, {
                resource_type:
                  msg.messageType === "video" ? "video" : "image",
              });
            }
          } catch (err) {
            console.log("Cloudinary delete error:", err.message);
          }
        }
      }
    }

    // 5️⃣ Delete messages from MongoDB
    await Message.deleteMany({
      _id: { $in: deleteList }
    });

    // 6️⃣ Prepare payload
    const payload = JSON.stringify({
      type: "DELETE_MESSAGE",
      deleteList
    });

    // 7️⃣ Notify only involved users
    usersToNotify.forEach(userId => {
      const client = onlineUsers.get(userId);

      if (client && client.readyState === 1) {
        client.send(payload);
      }
    });

  } catch (error) {
    console.log("Error in DELETE_MESSAGE:", error);

    ws.send(JSON.stringify({
      type: "ERROR",
      message: "Internal server error"
    }));
  }
}

module.exports = handleDeleteMessage;
