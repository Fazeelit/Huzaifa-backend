import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/UserManagementModel.js";
import Role from "../models/roleModel.js";
import {
  ROLE_KEYS,
  normalizeRoleKey,
  normalizeUserStatus,
  sanitizePermissions,
} from "../constants/accessControl.js";

async function getRolePermissions(role) {
  const normalizedRole = normalizeRoleKey(role);
  const roleDocument = await Role.findOne({ role: normalizedRole, status: "ACTIVE" })
    .select("permissions")
    .lean();

  return Array.isArray(roleDocument?.permissions) ? sanitizePermissions(roleDocument.permissions) : [];
}

async function ensureRoleIsAssignable(role) {
  const normalizedRole = normalizeRoleKey(role);
  if (!ROLE_KEYS.includes(normalizedRole)) {
    throw new Error("Invalid role selected.");
  }

  if (normalizedRole === "ADMIN") {
    return normalizedRole;
  }

  const roleDocument = await Role.findOne({ role: normalizedRole, status: "ACTIVE" }).lean();
  if (!roleDocument) {
    throw new Error("Selected role is not available or inactive.");
  }

  return normalizedRole;
}

function serializeUser(user, permissions = []) {
  return {
    _id: user._id,
    id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: normalizeRoleKey(user.role),
    permissions,
    department: user.department || "",
    status: normalizeUserStatus(user.status),
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

const createUser = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      role,
      department,
      status,
      securitySettings,
    } = req.body;

    if (!name || typeof name !== "string") {
      return res.status(400).json({ message: "Name is required and must be a string." });
    }

    if (!email || typeof email !== "string") {
      return res.status(400).json({ message: "Email is required and must be a string." });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Password is required and must be a string." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedRole = await ensureRoleIsAssignable(role);
    const normalizedStatus = normalizeUserStatus(status);

    if (await User.findOne({ email: normalizedEmail }).lean()) {
      return res.status(409).json({ message: "Email already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: String(phone || "").trim(),
      role: normalizedRole,
      department: String(department || "").trim(),
      status: normalizedStatus,
      securitySettings,
    });

    const permissions = await getRolePermissions(newUser.role);

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: serializeUser(newUser, permissions),
    });
  } catch (error) {
    console.error("Create User Error:", error);

    if (error?.name === "ValidationError") {
      const firstMessage = Object.values(error.errors || {})[0]?.message || "Validation failed";
      return res.status(400).json({ message: firstMessage, error: error.message });
    }

    if (error?.message === "Invalid role selected." || error?.message === "Selected role is not available or inactive.") {
      return res.status(400).json({ message: error.message });
    }

    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password, role } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const selectedRole = normalizeRoleKey(role);

    if (!normalizedEmail) {
      return res.status(400).json({ message: "Email is required and must be a string." });
    }

    if (!password || typeof password !== "string") {
      return res.status(400).json({ message: "Password is required and must be a string." });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (user.status !== "Active") {
      return res.status(403).json({ message: `Your account is ${user.status}. Please contact admin.` });
    }

    const hasHashedPassword =
      typeof user.password === "string" && user.password.startsWith("$2");

    let isMatch = false;
    let shouldUpgradePasswordHash = false;
    if (hasHashedPassword) {
      isMatch = await bcrypt.compare(password, user.password);
    } else {
      isMatch = password === user.password;
      shouldUpgradePasswordHash = isMatch;
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const normalizedRole = normalizeRoleKey(user.role);
    if (selectedRole && selectedRole !== normalizedRole) {
      return res.status(401).json({ message: "Selected role does not match your account role." });
    }

    const permissions = await getRolePermissions(normalizedRole);

    const token = jwt.sign(
      {
        id: user._id,
        name: user.name,
        role: normalizedRole,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE_IN || "7d" }
    );

    const loginUpdate = { lastLogin: new Date() };
    if (shouldUpgradePasswordHash) {
      loginUpdate.password = await bcrypt.hash(password, 10);
    }

    await User.updateOne({ _id: user._id }, { $set: loginUpdate }, { runValidators: false });

    return res.status(200).json({
      success: true,
      message: "User logged in successfully",
      data: {
        token,
        user: serializeUser({ ...user.toObject(), lastLogin: loginUpdate.lastLogin }, permissions),
      },
    });
  } catch (error) {
    console.error("Login Error:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 }).lean();
    const roles = await Role.find({ status: "ACTIVE" }).select("role permissions").lean();
    const rolePermissionMap = new Map(
      roles.map((role) => [normalizeRoleKey(role.role), sanitizePermissions(role.permissions)])
    );

    const serializedUsers = users.map((user) => {
      const normalizedRole = normalizeRoleKey(user.role);
      const permissions = rolePermissionMap.get(normalizedRole) || [];

      return serializeUser(user, permissions);
    });

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      users: serializedUsers,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const getUserById = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user ID" });
    }

    const user = await User.findById(userId).select("-password").lean();
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const permissions = await getRolePermissions(user.role);

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: serializeUser(user, permissions),
    });
  } catch (error) {
    console.error("Error in getUserById:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const updates = {};
    if (req.body.name) updates.name = String(req.body.name).trim();
    if (req.body.email) updates.email = String(req.body.email).trim().toLowerCase();
    if (req.body.phone !== undefined) updates.phone = String(req.body.phone || "").trim();
    if (req.body.department !== undefined) updates.department = String(req.body.department || "").trim();
    if (req.body.status) updates.status = normalizeUserStatus(req.body.status);
    if (req.body.password) {
      updates.password = await bcrypt.hash(req.body.password, 10);
    }
    if (Object.prototype.hasOwnProperty.call(req.body, "role")) {
      if (!String(req.body.role || "").trim()) {
        return res.status(400).json({ message: "Role selection is required." });
      }
      updates.role = await ensureRoleIsAssignable(req.body.role);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields to update" });
    }

    Object.assign(user, updates);
    await user.save();

    const permissions = await getRolePermissions(user.role);

    return res.status(200).json({
      message: "User updated successfully",
      user: serializeUser(user, permissions),
    });
  } catch (error) {
    console.error("Error updating user:", error);
    if (error?.message === "Invalid role selected." || error?.message === "Selected role is not available or inactive.") {
      return res.status(400).json({ message: error.message });
    }
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

const updateLastLogin = async (userId) => {
  try {
    return await User.findByIdAndUpdate(
      userId,
      { lastLogin: new Date() },
      { new: true, runValidators: false }
    ).select("-password");
  } catch (error) {
    console.error("Error updating lastLogin:", error);
    throw error;
  }
};

export {
  createUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateLastLogin,
};
