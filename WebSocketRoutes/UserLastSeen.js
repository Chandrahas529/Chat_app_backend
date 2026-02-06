const User = require("../Modals/User");

async function userLastSeen(userId) {
  if (!userId) return;
  try {
    await User.findByIdAndUpdate(
      userId,
      {
        isOnline: false,
        lastSeen: new Date(),
      }
    );
  } catch (error) {
    console.error("Error updating user last seen:", error);
  }
}

module.exports = userLastSeen;
