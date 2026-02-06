const Message = require("../Modals/Message");
const mongoose = require("mongoose");
const User = require("../Modals/User"); // make sure this is your Users model
const fs = require("fs");
const path = require("path");
const cloudinary = require("../cloudinaryConfig/cloudinaryConfig");

exports.createMessage = async (req,res) => {
    const {receiverId,messageType,messageText} = req.body;
    const senderId = req.user.userId;
    if(!senderId || !receiverId || !messageType || !messageText){
        res.status(400).json({message:"Invalid input data"});
    }
    try{
        let result = await Message.create({
            senderId,receiverId,messageText,messageType
        });
        res.status(200).json({message:"Message sent sucessful."});
    }
    catch(e){
        console.log("Error in creating message",e);
        res.status(500).json({message:"Internal server error. Please try again later."})
    }
}

exports.seenMessage = async (req,res) => {
    const seenMessageId = req.body.id;
    if(!id){
        res.status(404).json({message:"No id found"});
    }
    try{
        let result = await Message.updateOne(
            {"_id":seenMessageId},
            {seenMessage: true}
        )
        if(!result){
            res.status(404).json({message:"No message found"});
        }
        res.status(200).json({message:"Update successfull!"});
    }catch(e){
        console.log("Error in message seen ",e);
        res.status(500).json({message:"Internal server error.Please try again later"});
    }
}

exports.getChat = async (req,res) => {
    const friendId = req.body.friendId;
    const userId = req.user.userId;
    if(!friendId){
        res.status(400).json({message:"No id found"});
    }
    try{
        let result = await Message.find({
            $or:[
                {senderId:friendId,receiverId:userId},
                {senderId:userId,receiverId:friendId}
            ]
        }).sort({createdAt:-1});
         const mappedResult = result.map(msg => ({
            _id: msg._id.toString(),
            senderId: msg.senderId.toString() === userId ? null : msg.senderId.toString(),
            receiverId: msg.receiverId.toString() === userId ? null : msg.receiverId.toString(),
            messageType: msg.messageType,
            messageText: msg.messageText || null,
            messageUrl: msg.messageType !== "text" ? {
                senderUrl: msg.messageUrl?.senderUrl || null,
                receiverUrl: msg.messageUrl?.receiverUrl || null,
                networkUrl: msg.messageUrl?.networkUrl || null,
            } : null,
            seenStatus: msg.seenStatus || false,
            messageAt: msg.createdAt,
            itsMe: msg.senderId.toString() === userId.toString(),
        }));

         res.status(200).json(mappedResult);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getChatWithAll = async (req, res) => {
  try {
    if (!req.user?.userId) {
      return res.status(400).json({ message: "User id is required" });
    }

    const userId = new mongoose.Types.ObjectId(req.user.userId);

    const chats = await Message.aggregate([
      {
        $match: {
          $or: [{ senderId: userId }, { receiverId: userId }]
        }
      },
      { $sort: { messageAt: -1 } },
      {
        $addFields: {
          conversationId: {
            $cond: [
              { $gt: [{ $toString: "$senderId" }, { $toString: "$receiverId" }] },
              { $concat: [{ $toString: "$senderId" }, "_", { $toString: "$receiverId" }] },
              { $concat: [{ $toString: "$receiverId" }, "_", { $toString: "$senderId" }] }
            ]
          },
          otherUserId: { $cond: [{ $eq: ["$senderId", userId] }, "$receiverId", "$senderId"] },
          isUnread: { $cond: [{ $and: [{ $eq: ["$receiverId", userId] }, { $eq: ["$seenStatus", false] }] }, 1, 0] }
        }
      },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          unreadCount: { $sum: "$isUnread" }
        }
      },
      {
        $lookup: {
          from: "Users",
          localField: "lastMessage.otherUserId",
          foreignField: "_id",
          as: "otherUser"
        }
      },
      { $unwind: "$otherUser" },
      { $sort: { "lastMessage.messageAt": -1 } },
      {
        $project: {
          _id: 0,
          conversationId: "$_id",
          unreadCount: 1,
          otherUser: {
            userId: "$otherUser._id",
            mobile: "$otherUser.mobile",
            profileImage: "$otherUser.profileImage"
          },
          lastMessage: {
            senderId: "$lastMessage.senderId",
            receiverId: "$lastMessage.receiverId",
            messageType: "$lastMessage.messageType",
            messageText: "$lastMessage.messageText",
            messageUrl: "$lastMessage.messageUrl",
            seenStatus: "$lastMessage.seenStatus",
            messageAt: "$lastMessage.messageAt"
          }
        }
      }
    ]);
    return res.status(200).json(chats);
  } catch (err) {
    console.error("Error in get message with all:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.sendMedia = async (req, res) => {

  try {
    // 1️⃣ Validation
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No media uploaded" });
    }

    const { receiverId } = req.body;
    const createdMessages = [];

    // 2️⃣ Loop each file → ONE message per file
    for (const file of req.files) {
      const filePath = path.resolve(file.path);
      const ext = path.extname(file.originalname).toLowerCase();

      const isImage = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext);
      const isVideo = [".mp4", ".mov", ".avi", ".mkv", ".webm"].includes(ext);

      if (!isImage && !isVideo) {
        fs.unlinkSync(filePath);
        continue;
      }

      // 3️⃣ Upload to Cloudinary
      const upload = await cloudinary.uploader.upload(filePath, {
        folder: isImage
          ? "vaarta_app/sendImages"
          : "vaarta_app/sendVideos",
        resource_type: isImage ? "image" : "video",
      });

      fs.unlinkSync(filePath);
      //4️⃣ Save EXACTLY ONE message
      const message = await Message.create({
        senderId: req.user.userId,
        receiverId,
        messageType: isImage ? "image" : "video",
        messageUrl: {
          senderUrl: upload.secure_url,
          receiverUrl: upload.secure_url,
          networkUrl: upload.secure_url,
        },
      });

      createdMessages.push(message);
    }

    // 5️⃣ Respond
    res.status(200).json({
      message: "Media sent successfully",
      data: createdMessages,
    });

  } catch (error) {
    console.error("Send media error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.deleteMessages = async (req, res) => {
  const { deleteList } = req.body;

  if (!deleteList || !Array.isArray(deleteList) || deleteList.length === 0) {
    return res.status(400).json({ message: "No ids provided" });
  }

  try {
    // 1️⃣ Find messages to delete
    const messages = await Message.find({ _id: { $in: deleteList } });

    // 2️⃣ Delete media from Cloudinary if messageType is image/video
    for (const msg of messages) {
      if (msg.messageType === "image" || msg.messageType === "video") {
        const urls = [
          msg.messageUrl?.senderUrl,
          msg.messageUrl?.receiverUrl,
          msg.messageUrl?.networkUrl,
        ].filter(Boolean); // remove nulls

        for (const url of urls) {
          try {
            // Extract public_id from Cloudinary URL
            // Example URL: https://res.cloudinary.com/<cloud>/image/upload/v1234567890/vaarta_app/sendImages/filename.jpg
            const parts = url.split("/");
            const folderIndex = parts.findIndex((p) => p === "vaarta_app"); // folder start
            const publicId = parts.slice(folderIndex).join("/").replace(/\.[^/.]+$/, ""); // remove extension

            await cloudinary.uploader.destroy(publicId, {
              resource_type: msg.messageType === "video" ? "video" : "image",
            });
          } catch (err) {
            console.log("Cloudinary delete error:", err);
          }
        }
      }
    }

    // 3️⃣ Delete messages from MongoDB
    const result = await Message.deleteMany({ _id: { $in: deleteList } });

    if (!result.deletedCount) {
      return res.status(404).json({ message: "No messages found to delete" });
    }

    return res.status(200).json({ message: "Messages deleted successfully!" });
  } catch (e) {
    console.log("Error in deleteMessages:", e);
    return res.status(500).json({ message: "Internal server error. Please try again later" });
  }
};

// DELETE /message/delete-all
exports.deleteAllMessages = async (req, res) => {
  const { friendId } = req.body;
  if (!friendId) return res.status(400).json({ message: "Friend ID required" });

  try {
    // 1️⃣ Find all messages between the user and friend
    const messages = await Message.find({
      $or: [
        { senderId: req.user.userId, receiverId: friendId },
        { senderId: friendId, receiverId: req.user.userId },
      ],
    });

    // 2️⃣ Delete media from Cloudinary if any
    for (const msg of messages) {
      if (msg.messageType === "image" || msg.messageType === "video") {
        const urls = [msg.messageUrl?.senderUrl, msg.messageUrl?.receiverUrl, msg.messageUrl?.networkUrl].filter(Boolean);

        for (const url of urls) {
          try {
            const parts = url.split("/");
            const folderIndex = parts.findIndex((p) => p === "vaarta_app");
            const publicId = parts.slice(folderIndex).join("/").replace(/\.[^/.]+$/, "");
            await cloudinary.uploader.destroy(publicId, { resource_type: msg.messageType === "video" ? "video" : "image" });
          } catch (err) {
            console.log("Cloudinary delete error:", err);
          }
        }
      }
    }

    // 3️⃣ Delete all messages
    await Message.deleteMany({
      _id: { $in: messages.map((m) => m._id) },
    });

    res.status(200).json({ message: "All messages deleted successfully!" });
  } catch (err) {
    console.log("Error deleting all messages:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
