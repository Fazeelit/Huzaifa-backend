import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductName,
  updateStockAfterSale
} from "../controllers/productsController.js";

const router = express.Router();
router.use(verifyToken);

/* =======================
   PRODUCT ROUTES
======================= */

// Stats (dashboard cards / POS)
router.get("/stats", authorizePermissions("PRODUCT_VIEW", "POS_VIEW"), getProductStats);

// Get all products (search & filter)
router.get("/", authorizePermissions("PRODUCT_VIEW", "POS_VIEW"), getAllProducts);

router.get("/ProductName", authorizePermissions("PRODUCT_VIEW", "POS_VIEW"), getProductName);

// Get single product
router.get("/getProductById/:id", authorizePermissions("PRODUCT_VIEW", "POS_VIEW"), getProductById);

// Create product
router.post("/createProduct", authorizePermissions("PRODUCT_CREATE"), createProduct);

// Update product
router.put("/updateProduct/:id", authorizePermissions("PRODUCT_EDIT"), updateProduct);

// Delete product
router.delete("/deleteProduct/:id", authorizePermissions("PRODUCT_DELETE"), deleteProduct);

router.put("/updateStock/:productId", authorizePermissions("PRODUCT_EDIT"), updateStockAfterSale);

/* =======================
   EXPORT
======================= */

export default router;
