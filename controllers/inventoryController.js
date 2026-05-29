import mongoose from "mongoose";
import Product from "../models/productModel.js";
import InventoryStock from "../models/inventoryStockModel.js";
import Purchase from "../models/purchaseModel.js";
import { convertToBaseUnit } from "../util/uomConverter.js";

const normalizeMMYY = (value) => {
  if (!value) return "";

  const clean = String(value).trim();
  const yyyyMmMatch = clean.match(/^(\d{4})-(\d{2})$/);
  if (yyyyMmMatch) {
    const year = Number(yyyyMmMatch[1]);
    const month = Number(yyyyMmMatch[2]);
    if (month >= 1 && month <= 12 && year >= 2000) {
      return `${String(month).padStart(2, "0")}.${String(year % 100).padStart(2, "0")}`;
    }
  }

  const mmYyMatch = clean.replace("/", ".").match(/^(\d{1,2})\.(\d{2})$/);
  if (mmYyMatch) {
    const month = Number(mmYyMatch[1]);
    const yy = Number(mmYyMatch[2]);
    if (month >= 1 && month <= 12 && yy >= 0 && yy <= 99) {
      return `${String(month).padStart(2, "0")}.${String(yy).padStart(2, "0")}`;
    }
  }

  const date = new Date(clean);
  if (!Number.isNaN(date.getTime())) {
    return `${String(date.getUTCMonth() + 1).padStart(2, "0")}.${String(date.getUTCFullYear() % 100).padStart(2, "0")}`;
  }

  return "";
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return fallback;
};

const normalizeUomLevels = (levels = []) =>
  (Array.isArray(levels) ? levels : [])
    .map((level) => ({
      unit: String(level?.unit || "").trim(),
      contains: Number(level?.contains || 0),
      child: String(level?.child || "").trim(),
    }))
    .filter(
      (level) =>
        level.unit &&
        level.child &&
        Number.isFinite(level.contains) &&
        level.contains > 0
    );

const normalizeProductDate = (value) => {
  if (!value) return null;

  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const ddMmYyyy = String(value).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!ddMmYyyy) return null;

  const [, dd, mm, yyyy] = ddMmYyyy;
  const fallback = new Date(`${yyyy}-${mm}-${dd}`);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
};

const bulkStockInventory = async (req, res) => {
  try {
    const billNo = String(req.body?.billNo || "").trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (!billNo) {
      return res.status(400).json({ success: false, message: "billNo is required" });
    }

    if (!items.length) {
      return res.status(400).json({ success: false, message: "At least one item is required" });
    }

    const validated = [];

    for (const row of items) {
      const purchaseQty = Number(row?.purchaseQty || 0);
      const purchasePrice = Number(row?.purchasePrice || 0);
      const salePrice = Number(row?.salePrice || 0);

      if (purchaseQty <= 0 || purchasePrice < 0 || salePrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Invalid quantity/price for item: ${row?.name || "Unknown"}`,
        });
      }

      let product = null;
      if (row?.productId && mongoose.Types.ObjectId.isValid(row.productId)) {
        product = await Product.findById(row.productId);
      }

      if (!product && row?.name) {
        product = await Product.findOne({
          name: { $regex: `^${String(row.name).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        }).sort({ createdAt: 1 });
      }

      if (!product) {
        return res.status(400).json({
          success: false,
          message: `Product not found for item: ${row?.name || "Unknown"}`,
        });
      }

      validated.push({
        row,
        product,
        purchaseQty,
        purchasePrice,
        salePrice,
      });
    }

    const inventoryItems = [];
    let totalBaseUnitsAdded = 0;

    for (const entry of validated) {
      const { row, product, purchaseQty, purchasePrice, salePrice } = entry;
      const beforeStock = Number(product.stock || 0);
      const afterStock = Number((beforeStock + purchaseQty).toFixed(4));
      const uom = row?.uom || product.unit || product.baseUnit || "unit";
      const baseUnitsAdded = convertToBaseUnit(purchaseQty, uom, product);
      totalBaseUnitsAdded += baseUnitsAdded;
      const discountAllowed = parseBoolean(
        row?.discountAllowed === undefined ? product.discountAllowed : row.discountAllowed,
        false
      );
      const maxAllowedDiscount = discountAllowed
        ? Math.max(0, Number(row?.maxAllowedDiscount ?? product.maxAllowedDiscount ?? 0) || 0)
        : 0;

      const nextUpdate = {
        stock: afterStock,
        purchasePrice,
        salePrice,
        manufacturer: String(row?.manufacturer || row?.company || product.manufacturer || "").trim(),
        discountAllowed,
        maxAllowedDiscount,
        baseUnit: String(row?.baseUnit || product.baseUnit || product.unit || "unit").trim().toLowerCase(),
        uomLevels: normalizeUomLevels(
          Array.isArray(row?.uomLevels) && row.uomLevels.length
            ? row.uomLevels
            : product.uomLevels
        ),
        company: String(row?.company || product.company || product.manufacturer || "").trim(),
      };

      const normalizedDate = normalizeProductDate(row?.date || row?.purchaseDate);
      if (normalizedDate) {
        nextUpdate.date = normalizedDate;
      }

      if (row?.genName) nextUpdate.genName = String(row.genName).trim();
      if (row?.category) nextUpdate.category = row.category;
      if (Number.isFinite(Number(row?.shelf))) nextUpdate.shelf = Number(row.shelf);
      if (row?.unit) nextUpdate.unit = String(row.unit).trim();

      // Keep actualStock aligned with stock.
      nextUpdate.actualStock = Number(afterStock.toFixed(4));
      nextUpdate.lowStock = afterStock <= 10;

      try {
        await Product.updateOne(
          { _id: product._id },
          { $set: nextUpdate },
          { runValidators: true }
        );
      } catch (error) {
        throw new Error(
          `Failed to update product "${product.name}": ${error.message}`
        );
      }

      inventoryItems.push({
        productId: product._id,
        name: product.name,
        purchaseQty,
        purchasePrice,
        salePrice,
        uom,
        baseUnit: nextUpdate.baseUnit,
        stockQtyBase: baseUnitsAdded,
        beforeStock,
        afterStock,
      });
    }

    const stockEntry = await InventoryStock.create({
      billNo,
      items: inventoryItems,
      totalItems: inventoryItems.length,
      totalBaseUnitsAdded: Number(totalBaseUnitsAdded.toFixed(4)),
      stockedBy: String(req?.user?.email || req?.user?.id || ""),
    });

    const invoiceAsNumber = Number(billNo);
    const purchase = Number.isFinite(invoiceAsNumber)
      ? await Purchase.findOne({ invoiceNumber: invoiceAsNumber })
      : null;
    let purchaseStatusUpdated = false;
    if (purchase && purchase.purchaseStatus === "Draft") {
      purchase.purchaseStatus = "Completed";
      await purchase.save();
      purchaseStatusUpdated = true;
    }

    return res.status(201).json({
      success: true,
      message: "Bulk stock saved successfully",
      data: {
        billNo,
        totalItems: inventoryItems.length,
        totalBaseUnitsAdded: Number(totalBaseUnitsAdded.toFixed(4)),
        inventoryEntryId: stockEntry._id,
        purchaseStatusUpdated,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to bulk stock inventory",
      error: error.message,
    });
  }
};

export { bulkStockInventory };
