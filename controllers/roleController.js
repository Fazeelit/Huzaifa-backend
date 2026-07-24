import mongoose from "mongoose";
import Role from "../models/roleModel.js";
import User from "../models/UserManagementModel.js";
import {
  ROLE_KEYS,
  normalizeRoleKey,
  sanitizePermissions,
} from "../constants/accessControl.js";

function buildRolePayload(payload = {}) {
  return {
    role: normalizeRoleKey(payload.role),
    description: String(payload.description || "").trim(),
    permissions: sanitizePermissions(payload.permissions),
    status: String(payload.status || "ACTIVE").trim().toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

async function enrichRolesWithUserCount(roles) {
  const counts = await User.aggregate([
    { $group: { _id: "$role", userCount: { $sum: 1 } } },
  ]);

  const countMap = new Map(counts.map((item) => [String(item._id || "").toUpperCase(), item.userCount]));
  return roles.map((role) => ({
    ...role,
    userCount: countMap.get(String(role.role || "").toUpperCase()) || 0,
  }));
}

const createRole = async (req, res) => {
  try {
    const payload = buildRolePayload(req.body);

    if (!payload.role || !ROLE_KEYS.includes(payload.role)) {
      return res.status(400).json({ message: "A valid school role is required." });
    }

    if (!payload.permissions.length) {
      return res.status(400).json({ message: "At least one permission is required." });
    }

    const existingRole = await Role.findOne({ role: payload.role });
    if (existingRole) {
      return res.status(409).json({ message: "Role already exists." });
    }

    const savedRole = await Role.create(payload);
    return res.status(201).json({ message: "Role created successfully", role: savedRole });
  } catch (error) {
    console.error("Error creating role:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 }).lean();
    const hydratedRoles = await enrichRolesWithUserCount(roles);
    return res.status(200).json(hydratedRoles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid role id." });
    }

    const role = await Role.findById(id).lean();
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    const [hydratedRole] = await enrichRolesWithUserCount([role]);
    return res.status(200).json(hydratedRole);
  } catch (error) {
    console.error("Error fetching role:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid role id." });
    }

    const existingRole = await Role.findById(id);
    if (!existingRole) {
      return res.status(404).json({ message: "Role not found." });
    }

    const previousRoleKey = existingRole.role;
    const payload = buildRolePayload({
      role: req.body.role ?? existingRole.role,
      description: req.body.description ?? existingRole.description,
      permissions: req.body.permissions ?? existingRole.permissions,
      status: req.body.status ?? existingRole.status,
    });

    if (!ROLE_KEYS.includes(payload.role)) {
      return res.status(400).json({ message: "A valid school role is required." });
    }

    if (!payload.permissions.length) {
      return res.status(400).json({ message: "At least one permission is required." });
    }

    const conflictingRole = await Role.findOne({
      _id: { $ne: existingRole._id },
      role: payload.role,
    }).lean();

    if (conflictingRole) {
      return res.status(409).json({ message: "Another role already uses this key." });
    }

    existingRole.role = payload.role;
    existingRole.description = payload.description;
    existingRole.permissions = payload.permissions;
    existingRole.status = payload.status;

    const updatedRole = await existingRole.save();

    if (previousRoleKey !== payload.role) {
      await User.updateMany(
        { role: previousRoleKey },
        { $set: { role: payload.role } },
        { runValidators: false }
      );
    }

    return res.status(200).json({ message: "Role updated successfully", role: updatedRole });
  } catch (error) {
    console.error("Error updating role:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid role id." });
    }

    const role = await Role.findById(id).lean();
    if (!role) {
      return res.status(404).json({ message: "Role not found." });
    }

    if (role.role === "ADMIN") {
      return res.status(400).json({ message: "Admin role cannot be deleted." });
    }

    const assignedUsers = await User.countDocuments({ role: role.role });
    if (assignedUsers > 0) {
      return res.status(400).json({ message: "This role is assigned to users and cannot be deleted." });
    }

    await Role.findByIdAndDelete(id);
    return res.status(200).json({ message: "Role deleted successfully", role });
  } catch (error) {
    console.error("Error deleting role:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};

export {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole,
};
