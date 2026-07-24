import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dbConnect from "../config/database.js";
import User from "../models/UserManagementModel.js";

async function main() {
  const [, , emailArg, passwordArg] = process.argv;
  const email = String(emailArg || "").trim().toLowerCase();
  const newPassword = String(passwordArg || "");

  if (!email) {
    console.error("Usage: node scripts/resetUserPassword.js <email> <newPassword>");
    process.exit(1);
  }

  if (newPassword.length < 6) {
    console.error("New password must be at least 6 characters long.");
    process.exit(1);
  }

  await dbConnect();

  const user = await User.findOne({ email });
  if (!user) {
    console.error(`User not found: ${email}`);
    await mongoose.disconnect();
    process.exit(1);
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  console.log(`Password reset successfully for ${email}`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Failed to reset password:", error);

  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors during shutdown.
  }

  process.exit(1);
});
