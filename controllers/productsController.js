import mongoose from "mongoose";
import Product from "../models/productModel.js";

const resolveYearForExpirySync = (yy) => {
  const parsed = Number(yy);
  if (Number.isNaN(parsed)) return NaN;
  if (parsed >= 0 && parsed <= 99) return 2000 + parsed;
  return parsed;
};

const parseExpiryForAutoInactive = (value) => {
  if (value === null || value === undefined) return null;

  const clean = String(value).trim().replace("/", ".");
  const mmYY = clean.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (mmYY) {
    const month = Number(mmYY[1]);
    const year = resolveYearForExpirySync(mmYY[2].padStart(2, "0"));
    if (month >= 1 && month <= 12 && year >= 2000) return { month, year };
  }

  const digits = clean.replace(/\D/g, "");
  if (digits.length === 3 || digits.length === 4) {
    const padded = digits.padStart(4, "0");
    const month = Number(padded.slice(0, 2));
    const year = resolveYearForExpirySync(padded.slice(2));
    if (month >= 1 && month <= 12 && year >= 2000) return { month, year };
  }

  return null;
};

const isExpiryReachedForAutoInactive = (expValue) => {
  const parsed = parseExpiryForAutoInactive(expValue);
  if (!parsed) return false;

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (parsed.year < currentYear) return true;
  if (parsed.year === currentYear && parsed.month <= currentMonth) return true;
  return false;
};

const markExpiredProductsInactive = async () => {
  const activeProducts = await Product.find({ status: { $ne: "Inactive" } })
    .select("_id exp")
    .lean();

  const expiredIds = activeProducts
    .filter((product) => isExpiryReachedForAutoInactive(product?.exp))
    .map((product) => product._id);

  if (!expiredIds.length) return;

  await Product.updateMany(
    { _id: { $in: expiredIds } },
    { $set: { status: "Inactive" } }
  );
};

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
    await markExpiredProductsInactive();

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

    // Fetch products, return exactly as stored in DB (including numeric exp/mfg)
    const products = await Product.find(query).sort({ createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      count: products.length,
      data: products, // exp/mfg still numeric like 3.27
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
/* Resolve two-digit year in expiry context */
const resolveYear = (yy) => {
  yy = Number(yy);
  if (Number.isNaN(yy)) return NaN;
  if (yy >= 0 && yy <= 99) return 2000 + yy;
  return yy;
};

/* Parse legacy MM.YY values (string/number like 3.27, 03.27, 0327) */
const parseLegacyMMYY = (value) => {
  if (value === null || value === undefined) return null;

  const clean = String(value).trim().replace("/", ".");
  const mmYY = clean.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (mmYY) {
    const month = Number(mmYY[1]);
    const year = resolveYear(mmYY[2].padStart(2, "0"));
    if (month >= 1 && month <= 12 && year >= 2000) {
      return { month, year };
    }
  }

  const digits = clean.replace(/\D/g, "");
  if (digits.length === 3 || digits.length === 4) {
    const padded = digits.padStart(4, "0");
    const month = Number(padded.slice(0, 2));
    const year = resolveYear(padded.slice(2));
    if (month >= 1 && month <= 12 && year >= 2000) {
      return { month, year };
    }
  }

  return null;
};

/* Normalize any incoming expiry to strict MM.YY */
const normalizeMMYY = (value) => {
  if (!value) return null;

  const legacy = parseLegacyMMYY(value);
  if (legacy) {
    return `${String(legacy.month).padStart(2, "0")}.${String(
      legacy.year % 100
    ).padStart(2, "0")}`;
  }

  if (typeof value === "number" && value > 10000) {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(
        date.getUTCFullYear() % 100
      ).padStart(2, "0")}`;
    }
    return null;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) return null;

  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (year < 2000 || month < 1 || month > 12) return null;

  return `${String(month).padStart(2, "0")}.${String(year % 100).padStart(
    2,
    "0"
  )}`;
};

const normalizeUrduText = (value) =>
  String(value || "")
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

const getProductById = async (req, res) => {
  try {
    await markExpiredProductsInactive();

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
    const normalizedProduct = { ...product };

    normalizedProduct.mfg = normalizeMMYY(product.mfg);
    normalizedProduct.exp = normalizeMMYY(product.exp);

    res.status(200).json({
      success: true,
      data: normalizedProduct,
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
      bno: req.body.bno || "",

      mfg: normalizeMMYY(req.body.mfg),
      exp: normalizeMMYY(req.body.exp),
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
    await markExpiredProductsInactive();

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID",
      });
    }

    /* ---------------- NORMALIZE DATES ---------------- */

    /* ---------------- APPLY NORMALIZATION ---------------- */

    if ("mfg" in req.body) {
      if (!req.body.mfg) {
        req.body.mfg = null;
      } else {
        const normalized = normalizeMMYY(req.body.mfg);
        if (!normalized) {
          return res.status(400).json({
            success: false,
            message: "MFG must be in MM.YY format (example: 05.26)",
          });
        }
        req.body.mfg = normalized;
      }
    }

    if ("exp" in req.body) {
      if (!req.body.exp) {
        req.body.exp = null;
      } else {
        const normalized = normalizeMMYY(req.body.exp);
        if (!normalized) {
          return res.status(400).json({
            success: false,
            message: "EXP must be in MM.YY format (example: 05.26)",
          });
        }
        req.body.exp = normalized;
      }
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
    await markExpiredProductsInactive();

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
    await markExpiredProductsInactive();

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
