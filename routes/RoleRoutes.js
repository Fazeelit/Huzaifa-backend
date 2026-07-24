// routes/role.routes.js
import express from "express";
import {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole
} from "../controllers/roleController.js";

const router = express.Router();

router.post("/", createRole);
router.get("/", getRoles);
router.get("/:id", getRoleById);
router.post("/createRole", createRole);
router.put("/:id", updateRole);
router.put("/updateRole/:id", updateRole);
router.delete("/:id", deleteRole);
router.delete("/deleteRole/:id", deleteRole);

export default router;
