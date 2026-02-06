const express = require("express");
const messageController = require("../Controllers/MessageController");
const authenticate = require("../Middleware/middleware");
const sendMedia = require("../Middleware/SendMedia");

const router = express.Router();

router.post("/create",authenticate,messageController.createMessage);

router.post("/one-to-one-chat",authenticate,messageController.getChat);

router.get("/chat-with-all",authenticate,messageController.getChatWithAll);

router.delete("/delete",authenticate,messageController.deleteMessages);

router.post("/send-media",authenticate,sendMedia,messageController.sendMedia);

router.delete("/delete-all",authenticate,messageController.deleteAllMessages);

module.exports = router;