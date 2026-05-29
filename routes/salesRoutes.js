import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  getAllSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  returnSaleItems,
  updateSaleItemStatuses,
  recordSalePayment,
} from "../controllers/salesController.js";

const router = express.Router();
router.use(verifyToken);

/* =======================
   SALES ROUTES
======================= */

// Get all sales (supports search & filter via query params)
router.get("/", authorizePermissions("SALE_VIEW"), getAllSales);

// Get single sale by ID
router.get("/:id", authorizePermissions("SALE_VIEW"), getSaleById);

// Create new sale
router.post("/createSale", authorizePermissions("SALE_CREATE"), createSale);

// Update sale
router.put("/updateSale/:id", authorizePermissions("SALE_EDIT"), updateSale);

// Record payment for a registered customer sale
router.post("/:id/payment", authorizePermissions("SALE_EDIT"), recordSalePayment);

// Return selected sale items
router.put("/returnItems/:id", authorizePermissions("SALE_EDIT"), returnSaleItems);

// Update line item sold/returned statuses
router.put("/updateItemStatuses/:id", authorizePermissions("SALE_EDIT"), updateSaleItemStatuses);

// Delete sale
router.delete("/deleteSale/:id", authorizePermissions("SALE_DELETE"), deleteSale);

/* =======================
   EXPORT
======================= */

export default router;
