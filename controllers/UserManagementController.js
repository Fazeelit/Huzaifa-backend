import User from "../models/UserManagementModel.js"; // Path to your User model
import Role from "../models/roleModel.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const normalizeRole = (role) => String(role || "").trim().toUpperCase();
const escapeRegex = (value) => String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const LOGIN_USER_FIELDS =
  "_id name email password role department employeeId status lastLogin username";

const findLoginUser = async (value) => {
  const trimmedValue = String(value || "").trim();

  if (!trimmedValue) {
    return null;
  }

  const normalizedEmail = trimmedValue.toLowerCase();
  const exactPattern = new RegExp(`^${escapeRegex(trimmedValue)}$`, "i");

  const byEmail = await User.findOne({ email: normalizedEmail }).select(LOGIN_USER_FIELDS);
  if (byEmail) {
    return byEmail;
  }

  const byUsername = await User.findOne({ username: exactPattern }).select(LOGIN_USER_FIELDS);
  if (byUsername) {
    return byUsername;
  }

  return User.findOne({ name: exactPattern }).select(LOGIN_USER_FIELDS);
};

const buildLoginResponseUser = (user, permissions, lastLogin) => {
  const normalizedRole = normalizeRole(user.role);

  return {
    id: user._id,
    name: user.username || user.name || "Admin",
    email: user.email,
    role: normalizedRole,
    department: user.department || (normalizedRole === "ADMIN" ? "Administration" : ""),
    employeeId: user.employeeId || (normalizedRole === "ADMIN" ? "ADMIN" : ""),
    status: user.status,
    lastLogin,
    permissions,
  };
};

const ensureAssignableRole = async (role) => {
  const normalizedRole = normalizeRole(role);

  if (!normalizedRole) {
    return { ok: false, message: "Role is required." };
  }

  if (normalizedRole === "ADMIN") {
    return { ok: true, role: normalizedRole };
  }

  const roleDoc = await Role.findOne({
    role: normalizedRole,
    status: "ACTIVE",
  }).lean();

  if (!roleDoc) {
    return { ok: false, message: "Assigned role is not active or does not exist." };
  }

  return { ok: true, role: normalizedRole };
};
// ---------------------------
// CREATE USER
// ---------------------------
const createUser = async (req, res) => {
  try {
    const { name, email, password, phone, role, department, status, securitySettings } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!name || typeof name !== "string")
      return res.status(400).json({ message: "Name is required and must be a string" });

    if (!email || typeof email !== "string")
      return res.status(400).json({ message: "Email is required and must be a string" });

    if (!password || typeof password !== "string")
      return res.status(400).json({ message: "Password is required and must be a string" });

    // Check existing user
    if (await User.findOne({ email: normalizedEmail }))
      return res.status(400).json({ message: "Email already exists" });

    // Auto-generate Employee ID
    let employeeId = req.body.employeeId;
    if (!employeeId) {
      const lastUser = await User.findOne().sort({ createdAt: -1 });
      const lastIdNum = lastUser?.employeeId
        ? parseInt(lastUser.employeeId.split("-")[1])
        : 0;
      employeeId = `EMP-${String(lastIdNum + 1).padStart(3, "0")}`;
    }

    const roleCheck = await ensureAssignableRole(role || "USER");
    if (!roleCheck.ok) {
      return res.status(400).json({ message: roleCheck.message });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      phone,
      role: roleCheck.role,
      department,
      status: status || "Active",
      employeeId,
      securitySettings,
      createdAt: Date.now(),
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        employeeId: newUser.employeeId,
        status: newUser.status,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("❌ Create User Error:", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ---------------------------
// LOGIN USER (Email & Password Only)
// ---------------------------
const loginUser = async (req, res) => {
  try {
    const { email, password, role: requestedRole } = req.body;

    if (!email || typeof email !== "string")
      return res.status(400).json({ message: "Email is required and must be a string" });

    if (!password || typeof password !== "string")
      return res.status(400).json({ message: "Password is required and must be a string" });

    const user = await findLoginUser(email);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (
      requestedRole &&
      String(requestedRole).toUpperCase() !== String(user.role || "").toUpperCase()
    ) {
      return res.status(403).json({ message: "Selected role does not match user account role." });
    }

    // Check account status
    if (user.status !== "Active") {
      return res.status(403).json({
        message: `Your account is ${user.status}. Please contact admin.`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    const normalizedUserRole = normalizeRole(user.role);
    let permissions = [];

    if (normalizedUserRole === "ADMIN") {
      permissions = ["*"];
    } else {
      const roleDoc = await Role.findOne({
        role: normalizedUserRole,
        status: "ACTIVE",
      })
        .select("permissions")
        .lean();

      if (!roleDoc) {
        return res.status(403).json({
          message: "Assigned role is not active or does not exist.",
        });
      }

      permissions = Array.isArray(roleDoc.permissions) ? roleDoc.permissions : [];
    }

    const lastLogin = new Date();

    // Generate Token
    const token = jwt.sign(
      {
        id: user._id,
        name: user.username || user.name || "Admin",
        role: normalizedUserRole,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE_IN || "7d" }
    );

    // Do not block login success on a metadata-only write.
    void User.updateOne({ _id: user._id }, { $set: { lastLogin } }).catch((error) => {
      console.error("Failed to update last login:", error.message);
    });

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      data: {
        token,
        user: buildLoginResponseUser(user, permissions, lastLogin),
      },
    });
  } catch (error) {
    console.error("❌ Login Error:", error.message);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};


// ======================= GET ALL USERS ===========================
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "Users not found" });
    }

    return res.status(200).json({
      message: "Users fetched successfully",
      users,
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ======================= GET USER BY ID ===========================
const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    // Validate ObjectId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("❌ Error in getUserById:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ======================= UPDATE USER ===========================
const updateUser = async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      role,
      department,
      status,
      employeeId,
      securitySettings,
      password,
    } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (email) updates.email = email;
    if (phone) updates.phone = phone;
    if (role) {
      const roleCheck = await ensureAssignableRole(role);
      if (!roleCheck.ok) {
        return res.status(400).json({ message: roleCheck.message });
      }
      updates.role = roleCheck.role;
    }
    if (department) updates.department = department;
    if (status) updates.status = status;
    if (employeeId) updates.employeeId = employeeId;
    if (securitySettings) updates.securitySettings = securitySettings;

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (password) {
      const isSame = await bcrypt.compare(password, user.password);
      if (!isSame) {
        updates.password = await bcrypt.hash(password, 10);
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select("-password");

    return res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("??? Error updating user:", error.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ======================= DELETE USER ===========================
const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser)
      return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("❌ Error deleting user:", error.message);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ======================= RESET USER PASSWORD ===========================
const resetPasswordUser = async (req, res) => {
  try {
    const { email, oldPassword, newPassword, confirmPassword } = req.body;

    if (!email || typeof email !== "string")
      return res.status(400).json({ message: "Email is required and must be a string" });

    if (!oldPassword || typeof oldPassword !== "string")
      return res.status(400).json({ message: "Old password is required and must be a string" });

    if (!newPassword || typeof newPassword !== "string")
      return res.status(400).json({ message: "New password is required and must be a string" });

    if (!confirmPassword || typeof confirmPassword !== "string")
      return res.status(400).json({ message: "Confirm password is required and must be a string" });

    if (newPassword !== confirmPassword)
      return res.status(400).json({ message: "New password and confirm password do not match" });

    const user = await User.findOne({ email });
    if (!user)
      return res.status(404).json({ message: "User not found with this email" });

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Old password is incorrect" });

    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword)
      return res.status(400).json({
        message: "New password must be different from the old password",
      });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("❌ Reset Password Error:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

// ======================= UPDATE LAST LOGIN ===========================
const updateLastLogin = async (userId) => {
  try {
    await User.findByIdAndUpdate(userId, { lastLogin: new Date() });
  } catch (error) {
    console.error("❌ Error updating lastLogin:", error.message);
  }
};


// ---------------------------
// EXPORT ALL CONTROLLERS
// ---------------------------
export {
  createUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateLastLogin,
};
