const mongoose = require("mongoose");
const tokenSchema = new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    tokenHash:{
        type:String,
        required: true,
    },
    deviceId:{
        type:String
    },
    ipAddress: {
        type:String
    },
    userAgent: {
        type: String
    },
    expireAt:{
        type:Date,
        required:true
    },
    revoked:{
        type:Boolean,
        default:false
    }
},{timestamp:true,collection:"Tokens"});
module.exports = mongoose.model("Tokens",tokenSchema);