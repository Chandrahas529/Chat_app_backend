const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
    name:{
        type:String,
        required: [true, "Name is required"],
        trim: true,
        minlength: [2, "Name must be at least 2 characters"],
        maxlength: [50, "Name must be at most 50 characters"],
        match: [/^[a-zA-Z\s]+$/, "Name can only contain letters and spaces"]
    },
    mobile:{
        type: String,
        required: [true, "Mobile number is required"],
        unique: true,
        trim: true,
        match: [/^\+?\d{10,15}$/, "Invalid mobile number format"]
    },
    password: {
        type: String,
        required: [true, "Password is required"],
        minlength: [8, "Password must be at least 6 characters"]
    },
    email: {
        type: String,
        trim: true,
        lowercase: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email address"],
        sparse: true
    },
    status: {
        type: String,
        trim: true,
        maxlength: 150,
        default: "Hey there I'm using VAata app"
    },
    profileImage: {
        type: String,
        trim: true
    },
    lastSeen: {
        type:Date
    },
    isOnline: {
        type:Boolean,
        default: true
    },
    deviceToken: {
        type:String
    },
    platform: {
        type: String
    }
},{collection:"Users"});
module.exports = mongoose.model("Users",userSchema);