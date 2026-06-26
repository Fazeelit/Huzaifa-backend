import mongoose from "mongoose";
import Purchase from "../models/purchaseModel.js";
import SupplierPayment from "../models/supplierPaymentModel.js";
import Supplier from "../models/supplierModel.js";

const toTitleCase = (value = "") =>
  String(value)
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const generateUniqueSupplierId = async () => {
  for (let i = 0; i < 5; i += 1) {
    const candidate = `SUP-AUTO-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const exists = await Supplier.findOne({ supplierId: candidate }).lean();
    if (!exists) return candidate;
  }
  return `SUP-AUTO-${Date.now()}`;
};

const ensureSupplierExists = async (supplierName) => {
  try {
    const normalizedName = String(supplierName || "").trim();
    if (!normalizedName) return normalizedName;

    const existing = await Supplier.findOne({
      name: { $regex: `^${escapeRegex(normalizedName)}$`, $options: "i" },
    }).lean();

    if (existing) return existing.name;

    const normalizedDisplayName = toTitleCase(normalizedName);
    const supplierId = await generateUniqueSupplierId();

    await Supplier.create({
      supplierId,
      name: normalizedDisplayName,
      contactPerson: "",
      phone: "0300-0000000",
      email: "",
      address: "To be updated",
      companyName: "",
      productsSupplied: [],
      paymentTerms: "Cash",
      status: "Active",
      notes: "Auto-created from purchase bill. Please update supplier details.",
    });

    return normalizedDisplayName;
  } catch (error) {
    // Supplier master creation should not block purchase bill creation.
    return String(supplierName || "").trim();
  }
};

/* =======================
   GET ALL PURCHASES
======================= */
const getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: purchases.length,
      data: purchases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchases",
      error: error.message,
    });
  }
};

/* =======================
   GET PURCHASE BY ID
======================= */
const getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase ID" });
    }

    const purchase = await Purchase.findById(id);

    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    res.status(200).json({ success: true, data: purchase });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase",
      error: error.message,
    });
  }
};

/* =======================
   CREATE PURCHASE
======================= */
const createPurchase = async (req, res) => {
  try {
    const {
      supplier,
      purchaseDate,
      invoiceNumber,
      totalAmount,
      paidAmount,
      paymentStatus,
      purchaseStatus,
      balance,
      taxAmount,
      products,
    } = req.body;

    const normalizedSupplier = String(supplier || "").trim();
    const normalizedInvoiceNumber = String(invoiceNumber || "").trim();

    // Validate main fields
    if (!normalizedSupplier || !purchaseDate || !normalizedInvoiceNumber || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Supplier, purchase date, invoice number, and products are required",
      });
    }

    const supplierNameForPurchase = await ensureSupplierExists(normalizedSupplier);

    const normalizedProducts = products.map((p) => ({
      ...p,
      purchasePrice: p.purchasePrice ?? p.price,
    }));

    // Validate products array
    for (const p of normalizedProducts) {
      if (!p.productId || !p.name || p.quantity === undefined || p.quantity === null || !p.purchasePrice || !p.manufacturer) {
        return res.status(400).json({
          success: false,
          message: "Each product must have productId, name, quantity, purchasePrice, manufacturer",
        });
      }
    }

    const purchase = await Purchase.create({
      supplier: supplierNameForPurchase,
      purchaseDate,
      invoiceNumber: normalizedInvoiceNumber,
      totalAmount,
      paidAmount: typeof paidAmount !== "undefined" ? paidAmount : 0,
      paymentStatus: paymentStatus || "Pending",
      purchaseStatus: purchaseStatus || "Draft",
      balance: typeof balance !== "undefined" ? balance : totalAmount,
      taxAmount: typeof taxAmount !== "undefined" ? taxAmount : 0,
      products: normalizedProducts,
    });

    res.status(201).json({
      success: true,
      message: "Purchase created successfully",
      data: purchase,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create purchase",
      error: error.message,
    });
  }
};

/* =======================
   UPDATE PURCHASE
======================= */
const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase ID" });
    }

    const {
      supplier,
      purchaseDate,
      invoiceNumber,
      totalAmount,
      paidAmount,
      paymentStatus,
      purchaseStatus,
      balance,
      taxAmount,
      products,
    } = req.body;

    const normalizedSupplier = String(supplier || "").trim();
    const normalizedInvoiceNumber = String(invoiceNumber || "").trim();

    if (!normalizedSupplier || !purchaseDate || !normalizedInvoiceNumber || !Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Supplier, purchase date, invoice number, and products are required",
      });
    }

    const supplierNameForPurchase = await ensureSupplierExists(normalizedSupplier);

    const normalizedProducts = products.map((p) => ({
      ...p,
      purchasePrice: p.purchasePrice ?? p.price,
    }));

    for (const p of normalizedProducts) {
      if (!p.productId || !p.name || p.quantity === undefined || p.quantity === null || !p.purchasePrice || !p.manufacturer) {
        return res.status(400).json({
          success: false,
          message: "Each product must have productId, name, quantity, purchasePrice, manufacturer",
        });
      }
    }

    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    purchase.supplier = supplierNameForPurchase;
    purchase.purchaseDate = purchaseDate;
    purchase.invoiceNumber = normalizedInvoiceNumber;
    purchase.totalAmount = totalAmount;
    purchase.paidAmount = typeof paidAmount !== "undefined" ? paidAmount : purchase.paidAmount;
    purchase.paymentStatus = paymentStatus || purchase.paymentStatus;
    purchase.purchaseStatus = purchaseStatus || purchase.purchaseStatus;
    purchase.balance = typeof balance !== "undefined" ? balance : purchase.balance;
    purchase.taxAmount = typeof taxAmount !== "undefined" ? taxAmount : purchase.taxAmount;
    purchase.products = normalizedProducts;

    await purchase.save();

    res.status(200).json({
      success: true,
      message: "Purchase updated successfully",
      data: purchase,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update purchase",
      error: error.message,
    });
  }
};

const recordPurchasePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paidAmount = Number(req.body?.paidAmount ?? req.body?.amount ?? 0);
    const paymentDate = req.body?.paymentDate || req.body?.date || new Date();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase ID" });
    }

    if (paidAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid paid amount is required",
      });
    }

    const purchase = await Purchase.findById(id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    const paymentRecord = await SupplierPayment.create({
      supplier: purchase.supplier,
      paidAmount,
      appliedAt: paymentDate,
    });

    purchase.paidAmount = Number(purchase.paidAmount || 0) + paidAmount;
    purchase.paymentHistory.push({
      paymentId: paymentRecord._id,
      appliedAmount: paidAmount,
      appliedAt: paymentDate,
    });

    await purchase.save();

    res.status(200).json({
      success: true,
      message: "Purchase payment recorded successfully",
      purchase,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to record purchase payment",
      error: error.message,
    });
  }
};

const supplierPartialPayment = async (req, res) => {
  try {
    const { supplier } = req.params;
    const incomingPayment = Number(req.body.paidAmount);

    if (!supplier || incomingPayment <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid supplier and paid amount required",
      });
    }

    const purchases = await Purchase.find({
      supplier,
      paymentStatus: { $ne: "Paid" },
    }).sort({ createdAt: 1 });

    if (!purchases.length) {
      return res.status(404).json({
        success: false,
        message: "No unpaid purchases found",
      });
    }

    const paymentRecord = await SupplierPayment.create({
      supplier,
      paidAmount: incomingPayment,
    });

    let remaining = incomingPayment;

    for (const purchase of purchases) {
      if (remaining <= 0) break;

      const due = purchase.totalAmount - purchase.paidAmount;
      const applied = Math.min(due, remaining);

      if (applied > 0) {
        purchase.paidAmount += applied;
        remaining -= applied;

        purchase.paymentHistory.push({
          paymentId: paymentRecord._id,
          appliedAmount: applied,
          appliedAt: new Date(),
        });

        await purchase.save();
      }
    }

    const updatedPurchases = await Purchase.find({
      supplier,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: "Supplier payment applied successfully",
      purchases: updatedPurchases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to apply supplier payment",
      error: error.message,
    });
  }
};


/* =======================
   DELETE PURCHASE
======================= */
const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid purchase ID" });
    }

    const purchase = await Purchase.findByIdAndDelete(id);
    if (!purchase) {
      return res.status(404).json({ success: false, message: "Purchase not found" });
    }

    res.status(200).json({
      success: true,
      message: "Purchase deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete purchase",
      error: error.message,
    });
  }
};

/* =======================
   PURCHASE LIST (MINIMAL)
======================= */
const getPurchaseList = async (req, res) => {
  try {
    const purchases = await Purchase.find({}, { _id: 1, invoiceNumber: 1, supplier: 1 }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: purchases,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch purchase list",
      error: error.message,
    });
  }
};

export {
  getAllPurchases,
  getPurchaseById,
  createPurchase,
  updatePurchase,
  recordPurchasePayment,
  supplierPartialPayment,
  deletePurchase,
  getPurchaseList,
};
