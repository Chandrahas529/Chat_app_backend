const jwt = require("jsonwebtoken");

function authenticateWs(request) {
  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("No token");
  }

  const token = authHeader.split(" ")[1];

  try {
    const user = jwt.verify(token, process.env.ACCESS_KEY);
    return user;
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      throw new Error("Token expired");
    } else {
      throw new Error("Invalid token");
    }
  }
}

module.exports = authenticateWs;
