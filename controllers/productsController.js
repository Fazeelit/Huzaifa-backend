import mongoose from "mongoose";
import Product from "../models/productModel.js";

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const parseNonNegativeNumber = (value, fallback = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
};

/**
 * Get all products (search & filter) from URL params
 * Route: GET /api/products/:filter?/:search?
 */
const getAllProducts = async (req, res) => {
  try {
    // Accept search and filter from query parameters (safer than params)
    const { search = "", filter = "All" } = req.query;

    const query = {};

    // 🔍 Search by name, code, category
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } },
      ];
    }

    // 📌 Filters
    if (filter === "Active") query.status = "Active";
    if (filter === "Low Stock") {
      query.$or = query.$or
        ? [...query.$or, { stock: { $lte: 10 } }]
        : [{ stock: { $lte: 10 } }];
    }
    if (filter === "Out of Stock") query.stock = 0;

    // Fetch products, return exactly as stored in DB
    const products = await Product.find(query).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
      error: error.message,
    });
  }
};
/**
 * Get product by ID
 */

const normalizeUrduText = (value) =>
  String(value || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findById(id).lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    /* ✅ Normalize MFG / EXP before sending */
    res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch product",
      error: error.message,
    });
  }
};

/**
 * Create product (FINAL SAFE VERSION)
 */
const createProduct = async (req, res) => {
  try {
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Request body is empty",
      });
    }

    // ---------- SAFE DATE PARSER ----------
    const parseDate = (value) => {
      if (!value) return undefined; // IMPORTANT (not null)

      let date;

      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        date = new Date(value);
      } else if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(value)) {
        const [d, m, y] = value.split(/[-/]/);
        date = new Date(`${y}-${m}-${d}`);
      } else {
        throw new Error("Invalid date format");
      }

      if (isNaN(date.getTime())) {
        throw new Error("Invalid date value");
      }

      return date;
    };

    // ---------- NORMALIZED DATA ----------
    const productData = {
      name: normalizeUrduText(req.body.name),
      packSize: req.body.packSize?.trim(),
      shelf: req.body.shelf,
      code: req.body.code,
      category: req.body.category,
      unit: req.body.unit,
      baseUnit: req.body.baseUnit || req.body.unit,
      uomLevels: Array.isArray(req.body.uomLevels) ? req.body.uomLevels : [],
      discountAllowed: parseBoolean(req.body.discountAllowed, false),
      maxAllowedDiscount: parseNonNegativeNumber(req.body.maxAllowedDiscount, 0),

      purchasePrice: Number(req.body.purchasePrice ?? req.body.cost),
      retailSalePrice: Number(req.body.retailSalePrice ?? req.body.salePrice ?? req.body.price),
      wholeSalePrice: Number(req.body.wholeSalePrice ?? req.body.wholesalePrice ?? 0),
      salePrice: Number(req.body.retailSalePrice ?? req.body.salePrice ?? req.body.price),
      stock: Number(req.body.stock),

      manufacturer: normalizeUrduText(req.body.manufacturer),
      date: parseDate(req.body.date),

      status: (req.body.status || "Active").trim(),
      description: req.body.description,
    };

    if (!productData.discountAllowed) {
      productData.maxAllowedDiscount = 0;
    }

    const product = await Product.create(productData);

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });

  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);

    // ✅ Mongoose validation error
    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0].message,
      });
    }

    // ✅ Duplicate key
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    // ✅ Custom errors
    if (error.message.includes("date")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message,
    });
  }
};


/**
 * Update product
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    if ("date" in req.body) {
      const date = new Date(req.body.date);
      req.body.date = isNaN(date.getTime())
        ? null
        : date.toISOString();
    }

    if ("code" in req.body) {
      req.body.code = String(req.body.code || "").trim().toUpperCase();
      if (!req.body.code) {
        return res.status(400).json({
          success: false,
          message: "Product code is required",
        });
      }
    }

    if ("name" in req.body) {
      req.body.name = normalizeUrduText(req.body.name);
    }

    if ("manufacturer" in req.body) {
      req.body.manufacturer = normalizeUrduText(req.body.manufacturer);
    }

    if ("discountAllowed" in req.body) {
      req.body.discountAllowed = parseBoolean(req.body.discountAllowed, false);
      if (!req.body.discountAllowed) {
        req.body.maxAllowedDiscount = 0;
      } else if ("maxAllowedDiscount" in req.body) {
        req.body.maxAllowedDiscount = parseNonNegativeNumber(req.body.maxAllowedDiscount, 0);
      }
    } else if ("maxAllowedDiscount" in req.body) {
      req.body.maxAllowedDiscount = parseNonNegativeNumber(req.body.maxAllowedDiscount, 0);
    }

    if ("cost" in req.body && !("purchasePrice" in req.body)) {
      req.body.purchasePrice = req.body.cost;
    }
    if ("price" in req.body && !("salePrice" in req.body)) {
      req.body.salePrice = req.body.price;
    }
    if ("salePrice" in req.body && !("retailSalePrice" in req.body)) {
      req.body.retailSalePrice = req.body.salePrice;
    }
    if ("retailSalePrice" in req.body) {
      req.body.salePrice = req.body.retailSalePrice;
    }
    if ("wholesalePrice" in req.body && !("wholeSalePrice" in req.body)) {
      req.body.wholeSalePrice = req.body.wholesalePrice;
    }
    delete req.body.cost;
    delete req.body.price;
    delete req.body.wholesalePrice;

    /* ---------------- UPDATE ---------------- */

    const product = await Product.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: product,
    });
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "Field";
      return res.status(400).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message,
    });
  }
};


/**
 * Delete product
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const product = await Product.findByIdAndDelete(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully",
      data: product,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message,
    });
  }
};

/**
 * Product stats (dashboard)
 */
const getProductStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments();
    const activeProducts = await Product.countDocuments({ status: "Active" });
    const lowStock = await Product.countDocuments({ stock: { $lte: 10 } });
    const outOfStock = await Product.countDocuments({ stock: 0 });

    res.status(200).json({
      success: true,
      totalProducts,
      activeProducts,
      lowStock,
      outOfStock,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch stats",
      error: error.message,
    });
  }
};

/**
 * Get product names only (dropdowns)
 */
const getProductName = async (req, res) => {
  try {
    // Fetch name, manufacturer, sale price, stock, etc.
    const products = await Product.find(
      {},
      "name manufacturer salePrice retailSalePrice wholeSalePrice purchasePrice stock"
    ).sort({ name: 1 });

    res.status(200).json({
      success: true,
      data: products,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};


const updateStockAfterSale = async (req, res) => {
  try {
    const { productId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    const nextStock = Number(req.body?.stock);
    if (!Number.isFinite(nextStock) || nextStock < 0) {
      return res.status(400).json({
        success: false,
        message: "Stock must be a non-negative number",
      });
    }

    const product = await Product.findByIdAndUpdate(
      productId,
      { stock: nextStock },
      { new: true, runValidators: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Stock updated successfully",
      data: product,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to update stock",
      error: err.message,
    });
  }
};


/* =======================
   EXPORTS
======================= */
export {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductStats,
  getProductName,
  updateStockAfterSale
};
