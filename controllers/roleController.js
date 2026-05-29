// controllers/roleController.js
import Role from "../models/roleModel.js";

/* ---------------- CREATE ROLE ---------------- */
const createRole = async (req, res) => {
  try {
    const { role, description, permissions, status } = req.body;

    if (!role || !permissions) {
      return res.status(400).json({ message: "Role and permissions are required." });
    }

    const existingRole = await Role.findOne({ role: role.toUpperCase() });
    if (existingRole) {
      return res.status(400).json({ message: "Role already exists." });
    }

    const newRole = new Role({
      role: role.toUpperCase(),
      description,
      permissions,
      status: status || "ACTIVE",
    });

    const savedRole = await newRole.save();
    res.status(201).json({ message: "Role created successfully", role: savedRole });
  } catch (error) {
    console.error("❌ Error creating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ---------------- GET ALL ROLES ---------------- */
const getRoles = async (req, res) => {
  try {
    const roles = await Role.find().sort({ createdAt: -1 });
    res.status(200).json(roles);
  } catch (error) {
    console.error("❌ Error fetching roles:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ---------------- GET ROLE BY ID ---------------- */
const getRoleById = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.status(200).json(role);
  } catch (error) {
    console.error("❌ Error fetching role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ---------------- UPDATE ROLE ---------------- */
const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, description, permissions, status } = req.body;

    const existingRole = await Role.findById(id);
    if (!existingRole) {
      return res.status(404).json({ message: "Role not found" });
    }

    existingRole.role = role ? role.toUpperCase() : existingRole.role;
    existingRole.description = description !== undefined ? description : existingRole.description;
    existingRole.permissions = permissions || existingRole.permissions;
    existingRole.status = status || existingRole.status;

    const updatedRole = await existingRole.save();
    res.status(200).json({ message: "Role updated successfully", role: updatedRole });
  } catch (error) {
    console.error("❌ Error updating role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ---------------- DELETE ROLE ---------------- */
const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRole = await Role.findByIdAndDelete(id);

    if (!deletedRole) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.status(200).json({ message: "Role deleted successfully", role: deletedRole });
  } catch (error) {
    console.error("❌ Error deleting role:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

/* ---------------- EXPORT ALL ---------------- */
export {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole
};
