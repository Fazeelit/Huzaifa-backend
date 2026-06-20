import mongoose from "mongoose";
import Sale from "../models/salesModel.js";
import Product from "../models/productModel.js";

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeName = (value = "") =>
  String(value).toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/g, "");

const getActualUnits = (productDoc) => {
  const actualStock = Number(productDoc?.actualStock);
  const fallbackUnits = Number(productDoc?.stock) || 0;

  if (!Number.isFinite(actualStock) || actualStock < 0) return fallbackUnits;
  if (fallbackUnits > 0 && actualStock === 0) return fallbackUnits;
  return Math.max(actualStock, fallbackUnits);
};

const getInvoiceAmount = (quantity, salePrice) =>
  Number((Math.max(Number(quantity) || 0, 0) * (Number(salePrice) || 0)).toFixed(2));

const derivePaymentStatus = (paidAmount, totalAmount) => {
  const paid = Number(paidAmount) || 0;
  const total = Number(totalAmount) || 0;
  if (paid <= 0) return "Pending";
  if (paid >= total) return "Paid";
  return "Partial";
};

const isWalkInCustomer = (salePayload = {}) => {
  const customerName = String(salePayload?.customerName || "").trim().toLowerCase();
  return !customerName || customerName === "walk-in" || customerName === "walk in";
};

const normalizeOptionalObjectId = (value) =>
  value && mongoose.Types.ObjectId.isValid(value) ? value : null;

const resolveProductForSaleLine = async (line) => {
  if (line?.productId && mongoose.Types.ObjectId.isValid(line.productId)) {
    const byId = await Product.findById(line.productId);
    if (byId) return byId;
  }

  if (line?.name) {
    const namePattern = `^${escapeRegex(String(line.name).trim()).replace(/\s+/g, "\\s*")}$`;
    const byName = await Product.findOne({
      name: { $regex: namePattern, $options: "i" },
    }).sort({ createdAt: 1 });
    if (byName) return byName;
  }

  return null;
};

const applyStockDelta = async (productDoc, unitsDelta) => {
  const currentUnits = getActualUnits(productDoc);
  const nextUnits = currentUnits + (Number(unitsDelta) || 0);
  if (nextUnits < 0) {
    throw new Error(
      `Insufficient stock to mark item as sold for product: ${productDoc?.name || "Unknown"}`
    );
  }

  const nextStockValue = Number(nextUnits.toFixed(4));

  await Product.updateOne(
    { _id: productDoc._id },
    {
      $set: {
        stock: nextStockValue,
        actualStock: Number(nextUnits.toFixed(4)),
        lowStock: nextStockValue <= 10,
      },
    }
  );
};

const createSaleAndDeductStock = async (salePayload, session = null) => {
  const saleProducts = Array.isArray(salePayload.products) ? salePayload.products : [];
  const normalizedProducts = [];

  // Deduct sold units and keep stock aligned with actual stock.
  for (const soldItem of saleProducts) {
    const requestedUnits = Number(soldItem?.quantity ?? soldItem?.qty) || 0;
    if (requestedUnits <= 0) continue;

    const saleName = String(soldItem?.name || "").trim();
    const productId = soldItem?.productId;

    let variants = [];

    if (saleName) {
      const namePattern = `^${escapeRegex(saleName).replace(/\s+/g, "\\s*")}$`;
      let query = Product.find({
        name: { $regex: namePattern, $options: "i" },
      }).sort({ createdAt: 1 });

      if (session) query = query.session(session);
      variants = await query;

      if (!variants.length) {
        const normalizedSaleName = normalizeName(saleName);
        let fallbackQuery = Product.find({}).sort({ createdAt: 1 });
        if (session) fallbackQuery = fallbackQuery.session(session);
        const fallbackCandidates = await fallbackQuery;
        variants = fallbackCandidates.filter(
          (p) => normalizeName(p?.name) === normalizedSaleName
        );
      }
    } else if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      let query = Product.findById(productId);
      if (session) query = query.session(session);
      const single = await query;
      if (single) variants = [single];
    }

    if (!variants.length) {
      throw new Error(`Product not found for sale item: ${saleName || productId}`);
    }

    const totalAvailableUnits = variants.reduce(
      (sum, v) => sum + getActualUnits(v),
      0
    );

    if (totalAvailableUnits < requestedUnits) {
      throw new Error(
        `Insufficient stock for ${saleName || "sale item"} (requested ${requestedUnits}, available ${Math.floor(
          totalAvailableUnits
        )})`
      );
    }

    let remainingUnits = requestedUnits;
    let weightedCostTotal = 0;

    for (const variant of variants) {
      if (remainingUnits <= 0) break;

      const currentUnits = getActualUnits(variant);
      if (currentUnits <= 0) continue;

      const deductionUnits = Math.min(currentUnits, remainingUnits);
      const nextUnits = currentUnits - deductionUnits;

      variant.actualStock = Number(nextUnits.toFixed(4));
      const nextStockValue = Number(nextUnits.toFixed(4));
      const nextActualStockValue = Number(nextUnits.toFixed(4));
      const nextLowStock = nextStockValue <= 10;

      const updateQuery = Product.updateOne(
        { _id: variant._id },
        {
          $set: {
            stock: nextStockValue,
            actualStock: nextActualStockValue,
            lowStock: nextLowStock,
          },
        }
      );
      if (session) {
        updateQuery.session(session);
      }
      await updateQuery;

      const variantUnitCost = Number(variant.purchasePrice ?? variant.cost) || 0;
      weightedCostTotal += deductionUnits * variantUnitCost;
      remainingUnits -= deductionUnits;
    }

    const resolvedProductId =
      productId && mongoose.Types.ObjectId.isValid(productId)
        ? String(productId)
        : String(variants[0]._id);

    normalizedProducts.push({
      productId: resolvedProductId,
      name: saleName || String(variants[0]?.name || "").trim(),
      quantity: requestedUnits,
      purchasePrice:
        Number(soldItem?.purchasePrice) > 0
          ? Number(soldItem.purchasePrice)
          : Number((weightedCostTotal / requestedUnits).toFixed(4)),
      salePrice: Number(soldItem?.salePrice ?? soldItem?.price) || 0,
    });
  }

  if (!normalizedProducts.length) {
    throw new Error("No valid products found in sale payload");
  }

  const subtotal = Number(salePayload.subtotal) || 0;
  const discount = Number(salePayload.discount) || 0;
  const totalAmount = Number(salePayload.totalAmount) || 0;
  const paidAmount = Number(salePayload.paidAmount) || 0;
  const paymentStatus =
    salePayload.paymentStatus || derivePaymentStatus(paidAmount, totalAmount);
  const paymentMethod = String(salePayload.paymentMethod || "").trim();
  const paymentDate = salePayload.paymentDate ? new Date(salePayload.paymentDate) : null;
  const selectedCustomer = salePayload?.selectedCustomer || salePayload?.customer || {};
  const paymentHistory =
    paidAmount > 0
      ? [
          {
            amount: paidAmount,
            method: paymentMethod || (isWalkInCustomer(salePayload) ? "Cash" : ""),
            reference: String(salePayload.reference || "").trim(),
            date: paymentDate && !Number.isNaN(paymentDate.getTime()) ? paymentDate : new Date(),
          },
        ]
      : [];

  const finalPayload = {
    ...salePayload,
    invoiceNo: String(salePayload.invoiceNo || "").trim(),
    customerName: String(salePayload.customerName || "Walk-in").trim() || "Walk-in",
    customerId: normalizeOptionalObjectId(
      salePayload.customerId || selectedCustomer?._id || selectedCustomer?.id || null
    ),
    customerCnic: String(
      salePayload.customerCnic || selectedCustomer?.cnic || selectedCustomer?.customerCnic || ""
    ).trim(),
    customerPhone: String(
      salePayload.customerPhone || selectedCustomer?.phone || ""
    ).trim(),
    customerMobile: String(
      salePayload.customerMobile || selectedCustomer?.mobile || selectedCustomer?.phone || ""
    ).trim(),
    products: normalizedProducts,
    subtotal,
    discount,
    totalAmount,
    paidAmount,
    returnAmount: Number(salePayload.returnAmount) || Math.max(paidAmount - totalAmount, 0),
    paymentStatus,
    paymentMethod,
    paymentHistory,
  };

  if (session) {
    const [sale] = await Sale.create([finalPayload], { session });
    return sale;
  }

  return Sale.create(finalPayload);
};

/**
 * Get all sales
 * GET /api/sales
 */
const getAllSales = async (req, res) => {
  try {
    const { search = "", filter = "" } = req.query;

    const query = {};

    if (search) {
      query.customerName = { $regex: search, $options: "i" };
    }

    if (filter) {
      // e.g., filter by paymentStatus
      query.paymentStatus = filter;
    }

    const sales = await Sale.find(query)
      .populate("products.productId", "name code")
      .sort({ saleDate: -1 });

    res.status(200).json({
      success: true,
      count: sales.length,
      data: sales,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sales",
      error: error.message,
    });
  }
};

/**
 * Get single sale by ID
 * GET /api/sales/:id
 */
const getSaleById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const sale = await Sale.findById(id).populate(
      "products.productId",
      "name code"
    );

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.status(200).json(sale);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch sale",
      error: error.message,
    });
  }
};

/**
 * Create new sale
 * POST /api/sales
 */
const createSale = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionStarted = false;

  try {
    const salePayload = req.body || {};

    // ✅ Basic validation
    if (!salePayload.products || !salePayload.products.length) {
      return res.status(400).json({
        success: false,
        message: "No products provided",
      });
    }

    let createdSale;

    try {
      session.startTransaction();
      transactionStarted = true;

      createdSale = await createSaleAndDeductStock(
        salePayload,
        session
      );

      await session.commitTransaction();
    } catch (error) {
      const transactionUnsupported =
        error?.message?.includes("Transaction numbers are only allowed on a replica set member or mongos");

      if (!transactionUnsupported) {
        throw error;
      }

      createdSale = await createSaleAndDeductStock(salePayload, null);
    } finally {
      session.endSession();
    }

    res.status(201).json({
      success: true,
      message: "Sale created successfully",
      data: createdSale,
    });
  } catch (error) {
    if (transactionStarted) {
      try {
        await session.abortTransaction();
      } catch {}
    }
    try {
      session.endSession();
    } catch {}

    if (error?.name === "ValidationError" || error?.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: `Invalid sale payload: ${error.message}`,
        error: error.message,
      });
    }

    if (
      error?.message?.startsWith("Insufficient stock") ||
      error?.message?.startsWith("Product not found") ||
      error?.message === "No valid products found in sale payload"
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error("CREATE SALE ERROR:", error);

    res.status(500).json({
      success: false,
      message: error?.message || "Failed to create sale",
    });
  }
};

/**
 * Update sale
 * PUT /api/sales/:id
 */
const updateSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const sale = await Sale.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    res.status(200).json({
      success: true,
      message: "Sale updated successfully",
      data: sale,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update sale",
      error: error.message,
    });
  }
};

/**
 * Delete sale
 * DELETE /api/sales/:id
 */
const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid sale ID" });
    }

    const sale = await Sale.findById(id);

    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const stockRestoreWarnings = [];

    for (const line of sale.products || []) {
      const soldQty = Number(line.quantity) || 0;
      const returnedQty = Number(line.returnedQuantity) || 0;
      const netSoldQty = Math.max(soldQty - returnedQty, 0);
      if (netSoldQty <= 0) continue;

      const productDoc = await resolveProductForSaleLine(line);
      if (!productDoc) {
        stockRestoreWarnings.push(
          `Stock was not restored for ${line?.name || "Unknown"} because the product no longer exists.`
        );
        continue;
      }

      try {
        // Deleting sale means undoing stock deduction for net sold quantity.
        await applyStockDelta(productDoc, netSoldQty);
      } catch (error) {
        stockRestoreWarnings.push(
          `Stock was not fully restored for ${line?.name || "Unknown"}: ${error.message}`
        );
      }
    }

    await Sale.deleteOne({ _id: id });

    res.status(200).json({
      success: true,
      message: stockRestoreWarnings.length
        ? "Sale deleted with stock restore warnings"
        : "Sale deleted successfully",
      warnings: stockRestoreWarnings,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete sale",
      error: error.message,
    });
  }
};

/**
 * Return selected sold items
 * PUT /api/sales/returnItems/:id
 */
const returnSaleItems = async (req, res) => {
  try {
    const { id } = req.params;
    const selectedIndexes = Array.isArray(req.body?.selectedIndexes)
      ? req.body.selectedIndexes
      : [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale ID" });
    }
    if (!selectedIndexes.length) {
      return res.status(400).json({
        success: false,
        message: "At least one item must be selected for return",
      });
    }

    const uniqueIndexes = [...new Set(selectedIndexes.map((v) => Number(v)).filter(Number.isInteger))];
    if (!uniqueIndexes.length) {
      return res.status(400).json({ success: false, message: "Invalid selected item indexes" });
    }

    let updatedSale = null;
    let processedCount = 0;
    let totalReturnedValue = 0;
    const sale = await Sale.findById(id);
    if (!sale) {
      throw new Error("Sale not found");
    }

    for (const index of uniqueIndexes) {
      const line = sale.products?.[index];
      if (!line) continue;

      const soldQty = Number(line.quantity) || 0;
      const alreadyReturned = Number(line.returnedQuantity) || 0;
      const returnableQty = Math.max(soldQty - alreadyReturned, 0);
      if (returnableQty <= 0) continue;

      const productDoc = await resolveProductForSaleLine(line);

      if (!productDoc) {
        throw new Error(`Product not found for return item: ${line.name || "Unknown"}`);
      }

      await applyStockDelta(productDoc, returnableQty);

      line.returnedQuantity = alreadyReturned + returnableQty;
      totalReturnedValue += getInvoiceAmount(returnableQty, line.salePrice);
      processedCount += 1;
    }

    if (!processedCount) {
      throw new Error("Selected items are already fully returned");
    }

    const existingSubtotal =
      Number(sale.subtotal) ||
      (sale.products || []).reduce(
        (sum, p) => sum + (Number(p.salePrice) || 0) * (Number(p.quantity) || 0),
        0
      );

    sale.returnedAmount = Number((Number(sale.returnedAmount || 0) + totalReturnedValue).toFixed(2));
    sale.subtotal = Number(Math.max(existingSubtotal - totalReturnedValue, 0).toFixed(2));
    sale.totalAmount = Number(Math.max((Number(sale.totalAmount) || 0) - totalReturnedValue, 0).toFixed(2));
    sale.paidAmount = Number(Math.max((Number(sale.paidAmount) || 0) - totalReturnedValue, 0).toFixed(2));
    sale.returnAmount = Number(Math.max(sale.paidAmount - sale.totalAmount, 0).toFixed(2));
    sale.paymentStatus = derivePaymentStatus(sale.paidAmount, sale.totalAmount);

    updatedSale = await sale.save();

    return res.status(200).json({
      success: true,
      message: "Selected items returned successfully",
      data: updatedSale,
      summary: {
        returnedItems: processedCount,
        returnedAmount: Number(totalReturnedValue.toFixed(2)),
      },
    });
  } catch (error) {
    if (error?.message === "Sale not found") {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }
    if (
      error?.message?.startsWith("Product not found for return item") ||
      error?.message === "Selected items are already fully returned"
    ) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("RETURN SALE ITEMS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to return selected items",
      error: error.message,
    });
  }
};

/**
 * Update sale item statuses (Sold/Returned) from invoice edit mode
 * PUT /api/sales/updateItemStatuses/:id
 */
const updateSaleItemStatuses = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = Array.isArray(req.body?.updates) ? req.body.updates : [];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale ID" });
    }
    if (!updates.length) {
      return res.status(400).json({ success: false, message: "No item status updates provided" });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    let changedCount = 0;
    let financialDelta = 0;

    for (const raw of updates) {
      const index = Number(raw?.index);
      if (!Number.isInteger(index)) continue;

      const status = String(raw?.status || "").trim().toUpperCase();
      if (!["SOLD", "RETURNED"].includes(status)) continue;

      const line = sale.products?.[index];
      if (!line) continue;

      const qty = Number(line.quantity) || 0;
      if (qty <= 0) continue;

      const currentReturnedQty = Number(line.returnedQuantity) || 0;
      const targetReturnedQty = status === "RETURNED" ? qty : 0;
      const returnedQtyDelta = targetReturnedQty - currentReturnedQty;
      if (returnedQtyDelta === 0) continue;

      const productDoc = await resolveProductForSaleLine(line);
      if (!productDoc) {
        throw new Error(`Product not found for status update item: ${line.name || "Unknown"}`);
      }

      if (returnedQtyDelta > 0) {
        // Sold -> Returned: stock goes back up.
        await applyStockDelta(productDoc, returnedQtyDelta);
        financialDelta -= getInvoiceAmount(returnedQtyDelta, line.salePrice);
      } else {
        // Returned -> Sold: consume stock again.
        await applyStockDelta(productDoc, returnedQtyDelta);
        financialDelta += getInvoiceAmount(Math.abs(returnedQtyDelta), line.salePrice);
      }

      line.returnedQuantity = targetReturnedQty;
      changedCount += 1;
    }

    if (!changedCount) {
      return res.status(400).json({
        success: false,
        message: "No effective status changes were applied",
      });
    }

    const baseSubtotal =
      Number(sale.subtotal) ||
      (sale.products || []).reduce(
        (sum, p) => sum + getInvoiceAmount(p.quantity, p.salePrice),
        0
      );

    sale.subtotal = Number(Math.max(baseSubtotal + financialDelta, 0).toFixed(2));
    sale.totalAmount = Number(Math.max((Number(sale.totalAmount) || 0) + financialDelta, 0).toFixed(2));
    sale.paidAmount = Number(Math.max((Number(sale.paidAmount) || 0) + financialDelta, 0).toFixed(2));
    sale.returnedAmount = Number(
      Math.max((Number(sale.returnedAmount) || 0) - financialDelta, 0).toFixed(2)
    );
    sale.returnAmount = Number(Math.max(sale.paidAmount - sale.totalAmount, 0).toFixed(2));
    sale.paymentStatus = derivePaymentStatus(sale.paidAmount, sale.totalAmount);

    const updatedSale = await sale.save();

    return res.status(200).json({
      success: true,
      message: "Sale item statuses updated successfully",
      data: updatedSale,
      summary: {
        changedItems: changedCount,
      },
    });
  } catch (error) {
    if (error?.message?.startsWith("Product not found for status update item")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error?.message?.startsWith("Insufficient stock to mark item as sold")) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("UPDATE SALE ITEM STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update sale item statuses",
      error: error.message,
    });
  }
};

/**
 * Record customer bill payment against a sale
 * POST /api/sales/:id/payment
 */
const recordSalePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paidAmount = Number(req.body?.paidAmount ?? req.body?.amount ?? 0);
    const paymentMethod = String(req.body?.paymentMethod || req.body?.method || "").trim();
    const reference = String(req.body?.reference || "").trim();
    const paymentDate = req.body?.paymentDate ? new Date(req.body.paymentDate) : new Date();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid sale ID" });
    }

    if (paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Paid amount must be greater than 0",
      });
    }

    if (!paymentMethod) {
      return res.status(400).json({
        success: false,
        message: "Payment method is required",
      });
    }

    if (Number.isNaN(paymentDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid payment date",
      });
    }

    const sale = await Sale.findById(id);
    if (!sale) {
      return res.status(404).json({ success: false, message: "Sale not found" });
    }

    const remainingAmount = Math.max(Number(sale.totalAmount || 0) - Number(sale.paidAmount || 0), 0);
    if (paidAmount > remainingAmount) {
      return res.status(400).json({
        success: false,
        message: "Paid amount cannot exceed remaining amount",
      });
    }

    sale.paidAmount = Number((Number(sale.paidAmount || 0) + paidAmount).toFixed(2));
    sale.paymentStatus = derivePaymentStatus(sale.paidAmount, sale.totalAmount);
    sale.paymentMethod = paymentMethod;
    sale.returnAmount = Number(Math.max(sale.paidAmount - sale.totalAmount, 0).toFixed(2));
    sale.paymentHistory = [
      ...(Array.isArray(sale.paymentHistory) ? sale.paymentHistory : []),
      {
        amount: paidAmount,
        method: paymentMethod,
        reference,
        date: paymentDate,
      },
    ];

    const updatedSale = await sale.save();

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      sale: updatedSale,
    });
  } catch (error) {
    console.error("RECORD SALE PAYMENT ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to record sale payment",
      error: error.message,
    });
  }
};

/* =======================
   EXPORTS (AT END)
======================= */

export {
  getAllSales,
  getSaleById,
  createSale,
  updateSale,
  deleteSale,
  returnSaleItems,
  updateSaleItemStatuses,
  recordSalePayment,
};
