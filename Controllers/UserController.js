const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const User = require("../Modals/User");
const Token = require("../Modals/Token");
const fs = require('fs');
const path = require('path');
const cloudinary = require("../cloudinaryConfig/cloudinaryConfig");
require("dotenv");

exports.profilePicture = async (req, res) => {
  try {
    // 1️⃣ Check file exists
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // 2️⃣ Normalize path (Windows safe)
    const filePath = path.resolve(req.file.path);

    // 3️⃣ Upload to Cloudinary
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'vaarta_app/profileImages',
      resource_type: 'image'
    });

    // 4️⃣ Remove temp file
    fs.unlinkSync(filePath);

    // 5️⃣ Save Cloudinary URL to DB
    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { profileImage: result.secure_url },
      { new: true }
    );

    // 6️⃣ Respond
    res.status(200).json({
      message: 'Profile image uploaded successfully',
      url: result.secure_url,
      user: updatedUser
    });

  } catch (err) {
    console.error('Cloudinary upload error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.createUser = async (req,res) => {
    const { name, mobile, password } = req.body;
    if(!name || !mobile || !password){
        return res.status(400).json({message: "Please fill all the fields"});
    }
    if(password.length<6){
        return res.status(400).json({
        message: "Password must be at least 6 characters",
        fieldErrors: {
            password: "Password must be at least 6 characters"
        }
        });
    }
    try{
        const saltRounds = 10;
        const bcryptPassword = await bcrypt.hash(String(password),saltRounds);
        let result = await User.create({
            name: name,
            mobile: "+91"+mobile,
            password: bcryptPassword
        });
        console.log(result);
        const accessToken = jwt.sign(
            {userId:result._id},
            process.env.ACCESS_KEY,
            {expiresIn:'15m'}
        )
        const refreshToken = jwt.sign(
            {userId:result._id,type:"refresh-token"},
            process.env.REFRESH_KEY,
            {expiresIn:"7d"}
        )
        const cryptoPassword = crypto.createHash("sha256").update(refreshToken).digest("hex");
        await Token.create({
            userId:result._id,
            tokenHash:cryptoPassword,
            deviceId: req.body.deviceId || "unknown device",
            ipAddress: req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        return res.status(200).json({accessToken:accessToken,refreshToken:refreshToken});
    }catch(err){
        if(err.code === 11000){
            return res.status(409).json({message: "Mobile number is already registered"});
        }
        if(err.name === "ValidationError"){
            const errors = {};
            for (const field in err.errors) {
            errors[field] = err.errors[field].message;
            }

            return res.status(400).json({ errors });
        }
        console.log("Signup error",err);
        return res.status(500).json({message: "Something went wrong. Please try again later."});
    }
}

exports.loginUser = async (req,res) => {
    const { mobile, password } = req.body;
    if(!mobile || !password){
        return res.status(400).json({message: "Please fill all the fields."});
    }
    try{
        let result = await User.findOne({
            mobile:"+91"+mobile,
        })
        if(!result){
            return res.status(401).json({message:"Invalid mobile or password"});
        }
        const tokenVerify = await bcrypt.compare(String(password),result.password);
        if(!tokenVerify){
            return res.status(401).json({message:"Invalid mobile or password"});
        }
        const accessToken = jwt.sign(
            {userId:result._id},
            process.env.ACCESS_KEY,
            {expiresIn:"15m"}
        );
        const refreshToken = jwt.sign(
            {userId:result._id,type:"refresh-token"},
            process.env.REFRESH_KEY,
            {expiresIn:"7d"}
        );
        const cryptoPassword = crypto.createHash("sha256").update(refreshToken).digest("hex");
        await Token.deleteMany({
            userId:result._id
        });
        await Token.create({
            userId:result._id,
            tokenHash:cryptoPassword,
            deviceId: req.body.deviceId || "unknow device",
            ipAddress: req.headers['x-forwarded-for']?.split(",")[0] || req.socket.remoteAddress,
            userAgent: req.headers["user-agent"],
            expireAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        })
        return res.status(200).json({accessToken:accessToken,refreshToken:refreshToken});
    }catch(err){
        console.log("Login error ",err);
        return res.status(500).json({message:"Internal server error. Please try again later"});
    }
}

exports.friendsList = async (req,res) => {
    try{
        const contactList = req.body;
        if(!Array.isArray(contactList) || contactList.length == 0){
            return res.status(400).json({message:"No contacts provide"})
        }

        const phones = contactList.map(c => c.normalizedPhone);

        const users = await User.find({mobile: { $in: phones}}).select("_id profileImage mobile").lean();

        const usersMap = new Map(users.map(u => {u.mobile,u}));
        for(const contact of contactList){
            const user = usersMap.get(contact.normalizedPhone);
            contact.availableInApp = !!user;
            if(user){
                contact.id = user._id;
                contact.profileImage = user.profileImage;
            }
        }

        return res.status(200).json({message:"Contact processed successfully",data:contactList});
    }catch(error){
        console.error("FriendList error: ",error);
        return res.status(500).json({message: "Internal server error"});
    }
}

exports.getProfile = async (req,res) => {
    const token = req.user.userId;
    if(!token){
        return res.status(404).json({message:"No token found"});
    }
    try{
        const user = await User.findOne({"_id":token}).select("-password");
        if (!user) {
            return res.status(404).json({ message: "User not found." });
        }
        res.status(200).json(user);
    }catch(e){
        console.log("Error fetching user profile"+e);
        res.status(500).json({message:"Internal server error"});
    }
}

exports.getFriendDetail = async (req,res) => {
    const friendId = req.body.id;
    if(!friendId){
        return res.status(404).json({message:"No id found"});
    }
    try{
        const friend = await User.findOne({_id:friendId}).select("-password -email");
        if(!friend){
            return res.status(404).json({message:"User not found"});
        }
        res.status(200).json(friend);
    }catch(e){
        console.log("Error in friend detail"+e);
        res.status(500).json({message:"Internal server error"});
    }
}

exports.generateToken = async (req,res) => {
    const refreshTokenClient = req.headers['authorization'].split(" ")[1];
    if(!refreshTokenClient){
        return res.status(401).json({message:"Refresh token is missing"});
    }
    try{
        const payload = jwt.verify(refreshTokenClient,process.env.REFRESH_KEY);
        const tokenHashCLient = crypto.createHash("sha256").update(refreshTokenClient).digest("hex");
        let result = await Token.findOne({
            userId:payload.userId,
            tokenHash: tokenHashCLient
        });
        if(!result){
            return res.status(403).json({message:"Invalid token"});
        }
        const newAccessToken = jwt.sign(
            {userId:payload.userId},
            process.env.ACCESS_KEY,
            {expiresIn: "1m"}
        );
        console.log("Generated token")
        return res.status(200).json({accessToken:newAccessToken});
    }
    catch(err){
        console.log("Error in access token generating"+e);
        return res.status(500).json({message:"Internal server error"});
    }
}

exports.updateUser = async (req, res) => {
    const updateType = Object.keys(req.body)[0];
    const value = req.body[updateType];
    const userId = req.user.userId;

    if (!updateType || !value || !userId) {
        return res.status(400).json({ message: "Invalid request data" });
    }

    if (updateType !== "name" && updateType !== "status") {
        return res.status(400).json({ message: "Invalid field to update" });
    }

    if (value.length < 2) {
        return res
            .status(400)
            .json({ message: `${updateType} must be at least 2 characters long` });
    }
    if (updateType === "name") {
        const nameRegex = /^[a-zA-Z\s]+$/;
        if (!nameRegex.test(value)) {
            return res.status(400).json({
                message: "Name can only contain letters and spaces",
            });
        }
    }
    
    try {
        const result = await User.updateOne(
            { _id: userId },
            { $set: { [updateType]: value } }
        );
        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "Changes saved successfully!" });

    } catch (error) {
        return res
            .status(500)
            .json({ message: "Internal server error. Please try again later" });
    }
};

exports.setDeviceToken = async (req, res) => {
    const { deviceToken, platform } = req.body; // Expect deviceToken and optional platform
    const userId = req.user.userId;

    if (!deviceToken || !userId) {
        return res.status(400).json({ message: "Invalid request data" });
    }

    try {
        const result = await User.updateOne(
            { _id: userId },
            { $set: { deviceToken, platform } } // Save token and platform (android/ios)
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "Device token saved successfully!" });

    } catch (error) {
        console.error("Error saving device token:", error);
        return res
            .status(500)
            .json({ message: "Internal server error. Please try again later" });
    }
};


exports.deleteDeviceToken = async (req, res) => {
    const userId = req.user.userId;

    if (!userId) {
        return res.status(400).json({ message: "Invalid request" });
    }

    try {
        const result = await User.updateOne(
            { _id: userId },
            { $unset: { deviceToken: "" } } // removes the token
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ message: "User not found" });
        }

        return res.status(200).json({ message: "Device token deleted successfully!" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Internal server error" });
    }
};
