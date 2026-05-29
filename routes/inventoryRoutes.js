import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import { bulkStockInventory } from "../controllers/inventoryController.js";

const router = express.Router();
router.use(verifyToken);

router.post("/bulk-stock", authorizePermissions("PRODUCT_CREATE", "PRODUCT_EDIT"), bulkStockInventory);

export default router;

