const jwt = require("jsonwebtoken");
require("dotenv");
function authenticate(req,res,next){
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    const token = authHeader && authHeader.split(" ")[1];
    if(!token){
        return res.status(404).json({message:"Token not found"});
    }
    jwt.verify(token,process.env.ACCESS_KEY,(err,user)=>{
        if(err){
            console.log("Jwt error ",err.message);
            return res.status(401).json({message:"Invalid token"});
        }
        req.user = user;
        next();
    })
}
module.exports = authenticate;