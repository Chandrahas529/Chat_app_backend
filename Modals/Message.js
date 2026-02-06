const mongoose = require("mongoose");

const mediaUrlSchema = new mongoose.Schema({
    senderUrl:{
        type:String,
    },
    receiverUrl:{
        type:String,
    },
    networkUrl:{
        type:String,
    }
});

const messageSchema = new mongoose.Schema({
    senderId:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref:"Users",
    },
    receiverId:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref:"Users",
    },
    messageType:{
        type: String,
        enum: ["text", "image", "video", "file"],
        required: true,
    },
    messageText:{
        type: String,
    },
    messageUrl:{
        type: mediaUrlSchema,
    },
    seenStatus:{
        type: Boolean,
        required: true,
        default: false,
    },
    messageAt:{
        type: Date,
        default: Date.now,
    },
},{timestamps:true,collection:"Messages"});

module.exports = mongoose.model("Messages",messageSchema);