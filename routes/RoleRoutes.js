// routes/role.routes.js
import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  createRole,
  getRoles,
  getRoleById,
  updateRole,
  deleteRole
} from "../controllers/roleController.js";

const router = express.Router();

router.use(verifyToken);

router.get("/", authorizePermissions("ROLE_VIEW"), getRoles);
router.get("/:id", authorizePermissions("ROLE_VIEW"), getRoleById);
router.post("/createRole", authorizePermissions("ROLE_CREATE"), createRole);
router.put("/updateRole/:id", authorizePermissions("ROLE_EDIT"), updateRole);
router.delete("/deleteRole/:id", authorizePermissions("ROLE_DELETE"), deleteRole);

export default router;
