const e = require("express");
const { url } = require("../cloudinaryConfig/cloudinaryConfig");
const Message = require("../Modals/Message");

const cloudinary = require("cloudinary").v2;
async function handleDeleteMessage(ws, data, onlineUsers){
    const {deleteList} = data;
    if(!deleteList || !Array.isArray(deleteList) || deleteList.length === 0){
        ws.send(JSON.stringify({
            type: "ERROR",
            message: "No ids provided"
        }));
        return;
    }

    try{
        const messages = await Message.find({
            _id: { $in: deleteList}
        });

        if(!messages.length){
            ws.send(JSON.stringify({
                type: "ERROR",
                message: "No messages found"
            }))
            return;
        }
        const usersToNotify = new Set();

        for( const msg of messages){
            usersToNotify.add(msg.senderId.toString());
            usersToNotify.add(msg.receiverId.toString());

            if(msg.messageType === "image" || msg.messageType === "video"){
                const urls = [
                    msg.messageUrl?.senderUrl,
                    msg.messageUrl?.receiverUrl,
                    msg.messageUrl?.networkUrl,
                ].filter(Boolean);

                for(const uil of urls){
                    try{
                        const parts = url.split("/");
                        const folderIndex = parts.findIndex(p => p === "vaarta_app");

                        if(folderIndex !== -1){
                            const publicId = parts
                                .slice(folderIndex)
                                .join("/")
                                .replace(/\.[^/.]+$/, "");

                            await cloudinary.uploader.destroy(publicId, {
                                resource_type:
                                    msg.messageType === "video" ? "video" : "image",
                            });
                        }
                    }catch(err){
                        console.log("Cloudinary delete error : ",err.message);
                    }
                }
            }
        }
        await Message.deleteMany({
            _id: { $in: deleteList}
        });

        const payload = JSON.stringify({
            type: "DELETE_MESSAGE",
            deleteList
        });

        usersToNotify.forEach(userId => {
            const client = onlineUsers.get(userId);

            if(client && client.readyState === 1) {
                client.send(payload);
            }
        });
    }catch(error){
        console.log("Error in DELETE_MESSAGE: ",error);
        ws.send(JSON.stringify({
            type: "ERROR",
            message: "Internal server error"
        }));
    }
}

module.exports = handleDeleteMessage;