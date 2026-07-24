import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import dbConnect from "../config/database.js";
import User from "../models/UserManagementModel.js";
import { normalizeRoleKey, normalizeUserStatus } from "../constants/accessControl.js";

async function main() {
  const [, , emailArg, passwordArg, roleArg = "ADMIN", nameArg = "Admin User"] = process.argv;
  const email = String(emailArg || "").trim().toLowerCase();
  const password = String(passwordArg || "");
  const role = normalizeRoleKey(roleArg);
  const name = String(nameArg || "").trim();

  if (!email || !password) {
    console.error(
      "Usage: node scripts/ensureUser.js <email> <password> [role] [name]"
    );
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Password must be at least 6 characters long.");
    process.exit(1);
  }

  await dbConnect();

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await User.findOneAndUpdate(
    { email },
    {
      $set: {
        name: name || "Admin User",
        password: hashedPassword,
        role,
        status: normalizeUserStatus("Active"),
      },
      $setOnInsert: {
        phone: "",
        department: "",
        securitySettings: {
          requirePasswordChange: false,
          twoFactorAuth: false,
          ipRestrictions: [],
        },
      },
    },
    {
      upsert: true,
      new: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log(`User ensured successfully: ${user.email} (${user.role})`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("Failed to ensure user:", error);

  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect errors during shutdown.
  }

  process.exit(1);
});
