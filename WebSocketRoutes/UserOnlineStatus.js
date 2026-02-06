const User = require("../Modals/User");

async function userOnlineStatus(userId) {
  if (!userId) return;

  try {
    await User.findByIdAndUpdate(
      userId,
      {
        isOnline: true,
      },
    );
  } catch (error) {
    console.error("Error updating user online status:", error);
  }
}

module.exports = userOnlineStatus;
