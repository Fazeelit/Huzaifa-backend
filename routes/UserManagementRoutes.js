import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  createUser,
  loginUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  updateLastLogin,
} from "../controllers/UserManagementController.js";

const router = express.Router();

// ---------------------------
// User Management Routes
// ---------------------------

// User login
router.post("/login", loginUser);
router.use(verifyToken);

// Get all users
router.get("/", authorizePermissions("USER_VIEW"), getUsers);

// Get a single user by ID
router.get("/:id", authorizePermissions("USER_VIEW"), getUserById);

// Update a user by ID
router.put("/updateUser/:id", authorizePermissions("USER_EDIT"), updateUser);

// Delete a user by ID
router.delete("/deleteUser/:id", authorizePermissions("USER_DELETE"), deleteUser);

// Create a new user
router.post("/createUser", authorizePermissions("USER_CREATE"), createUser);

// Update last login timestamp
router.patch("/lastLogin/:id", authorizePermissions("USER_EDIT"), async (req, res) => {
  try {
    const updatedUser = await updateLastLogin(req.params.id);
    res.status(200).json({ message: "Last login updated", user: updatedUser });
  } catch (error) {
    console.error("Error updating last login:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
