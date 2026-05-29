import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  recordPurchasePayment,
  supplierPartialPayment,
  deletePurchase,
  getPurchaseList,
} from "../controllers/purchaseController.js";

const router = express.Router();
router.use(verifyToken);

/* =======================
   PURCHASE ROUTES
======================= */

// Get purchase list (minimal)
router.get("/list", authorizePermissions("PURCHASE_VIEW"), getPurchaseList);

// Get all purchases
router.get("/", authorizePermissions("PURCHASE_VIEW"), getAllPurchases);

// Get single purchase by ID
router.get("/:id", authorizePermissions("PURCHASE_VIEW"), getPurchaseById);

// Record payment against a single purchase
router.post("/:id/payment", authorizePermissions("PURCHASE_EDIT", "PARTIAL_PAYMENT_ADD"), recordPurchasePayment);

// Create new purchase
router.post("/createPurchase", authorizePermissions("PURCHASE_CREATE"), createPurchase);

// Update purchase
router.put("/updatePurchase/:id", authorizePermissions("PURCHASE_EDIT"), updatePurchase);

router.put("/supplierPayment/:supplier", authorizePermissions("PURCHASE_EDIT", "PARTIAL_PAYMENT_ADD"), supplierPartialPayment);

// Delete purchase
router.delete("/deletePurchase/:id", authorizePermissions("PURCHASE_DELETE"), deletePurchase);

export default router;
