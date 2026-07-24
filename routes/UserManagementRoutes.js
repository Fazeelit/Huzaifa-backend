import express from "express";
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

// Create a new user
router.post("/", createUser);
router.post("/createUser", createUser);

// User login
router.post("/login", loginUser);

// Get all users
router.get("/", getUsers);

// Get a single user by ID
router.get("/:id", getUserById);

// Update a user by ID
router.put("/:id", updateUser);
router.put("/updateUser/:id", updateUser);

// Delete a user by ID
router.delete("/:id", deleteUser);
router.delete("/deleteUser/:id", deleteUser);

// Update last login timestamp
router.patch("/lastLogin/:id", async (req, res) => {
  try {
    const updatedUser = await updateLastLogin(req.params.id);
    res.status(200).json({ message: "Last login updated", user: updatedUser });
  } catch (error) {
    console.error("Error updating last login:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

export default router;
