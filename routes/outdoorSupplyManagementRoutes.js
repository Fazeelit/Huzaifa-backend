import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  getOutdoorSuppliers,
  getOutdoorSupplierById,
  createOutdoorSupplier,
  updateOutdoorSupplier,
  deleteOutdoorSupplier,
  getOutdoorSupplies,
  getOutdoorSupplyById,
  createOutdoorSupply,
  updateOutdoorSupply,
  deleteOutdoorSupply,
} from "../controllers/outdoorSupplyManagementController.js";

const router = express.Router();

router.use(verifyToken);

router.get("/suppliers", authorizePermissions("PURCHASE_VIEW"), getOutdoorSuppliers);
router.post("/createOutdoorSupplier", authorizePermissions("PURCHASE_CREATE"), createOutdoorSupplier);
router.get("/suppliers/:id", authorizePermissions("PURCHASE_VIEW"), getOutdoorSupplierById);
router.put("/updateOutdoorSupplier/:id", authorizePermissions("PURCHASE_EDIT"), updateOutdoorSupplier);
router.delete("/deleteOutdoorSupplier/:id", authorizePermissions("PURCHASE_DELETE"), deleteOutdoorSupplier);

router.get("/", authorizePermissions("PURCHASE_VIEW"), getOutdoorSupplies);
router.post("/createOutdoorSupply", authorizePermissions("PURCHASE_CREATE"), createOutdoorSupply);
router.get("/:id", authorizePermissions("PURCHASE_VIEW"), getOutdoorSupplyById);
router.put("/updateOutdoorSupply/:id", authorizePermissions("PURCHASE_EDIT"), updateOutdoorSupply);
router.delete("/deleteOutdoorSupply/:id", authorizePermissions("PURCHASE_DELETE"), deleteOutdoorSupply);

export default router;
