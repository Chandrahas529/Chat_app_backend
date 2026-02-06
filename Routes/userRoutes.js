const express = require("express");
const userController = require("../Controllers/UserController");
const router = express.Router();
const authenticateToken = require("../Middleware/middleware");
const authenticate = require("../Middleware/middleware");
const upload = require("../Controllers/UploadProfileImage");

router.post("/create",userController.createUser);

router.post("/login",userController.loginUser);

router.put("/update-user",authenticateToken,userController.updateUser);

router.post("/friends-list",authenticateToken,userController.friendsList);

router.post("/profile",authenticateToken,userController.getProfile);

router.post("/friend-details",authenticateToken,userController.getFriendDetail);

router.get("/refresh-token",userController.generateToken);

router.post("/profile-image",authenticate,upload,userController.profilePicture);

router.post("/device-token",authenticate,userController.setDeviceToken);

router.delete("/delete-device-token",authenticate,userController.deleteDeviceToken);

module.exports = router;