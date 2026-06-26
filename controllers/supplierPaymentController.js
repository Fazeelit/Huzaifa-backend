import mongoose from "mongoose";
import Supplier from "../models/supplierModel.js";
import Purchase from "../models/purchaseModel.js";
import SupplierPayment from "../models/supplierPaymentModel.js";

const parseAmount = (value) => {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const formatRs = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

const normalizeDateString = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().split("T")[0];
  }
  return date.toISOString().split("T")[0];
};

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const buildSupplierResponse = (supplierDoc) => {
  const supplier = supplierDoc?.toObject ? supplierDoc.toObject() : supplierDoc || {};
  return {
    ...supplier,
    phone: supplier?.phone || supplier?.mobile || "",
    mobile: supplier?.mobile || supplier?.phone || "",
    company: supplier?.companyName || supplier?.company || "",
    products: Array.isArray(supplier?.productsSupplied) ? supplier.productsSupplied : [],
    openingBalance: Number(supplier?.openingBalance ?? 0) || 0,
    creditLimit: Number(supplier?.creditLimit ?? 0) || 0,
    preferred: Boolean(supplier?.preferred),
  };
};

const buildStatisticsFromBills = (bills = []) => {
  const summary = {
    totalBills: 0,
    paidBills: 0,
    pendingBills: 0,
    overdueBills: 0,
    totalAmount: 0,
    paidAmount: 0,
    pendingAmount: 0,
    overdueAmount: 0,
    lastPaymentDate: "",
    nextPaymentDue: "",
    averagePaymentDays: 0,
  };

  bills.forEach((bill) => {
    const amount = parseAmount(bill?.amount);
    const paidAmount = parseAmount(bill?.paidAmount);
    const remainingAmount = Math.max(amount - paidAmount, 0);
    const status = String(bill?.status || "").toLowerCase();

    summary.totalBills += 1;
    summary.totalAmount += amount;

    if (status === "paid") {
      summary.paidBills += 1;
      summary.paidAmount += amount;
      if (bill?.paidDate) {
        summary.lastPaymentDate = bill.paidDate;
      }
      return;
    }

    if (status === "overdue") {
      summary.overdueBills += 1;
      summary.overdueAmount += remainingAmount;
      return;
    }

    summary.pendingBills += 1;
    summary.pendingAmount += remainingAmount;
  });

  return {
    ...summary,
    totalAmount: formatRs(summary.totalAmount),
    paidAmount: formatRs(summary.paidAmount),
    pendingAmount: formatRs(summary.pendingAmount),
    overdueAmount: formatRs(summary.overdueAmount),
  };
};

const recalculateSupplierState = (supplier) => {
  const bills = Array.isArray(supplier?.bills) ? supplier.bills : [];
  supplier.statistics = buildStatisticsFromBills(bills);
  supplier.totalDue = bills.reduce(
    (sum, bill) => sum + Math.max(parseAmount(bill?.amount) - parseAmount(bill?.paidAmount), 0),
    0,
  );
};

const getBillReferenceValue = (billLike = {}) =>
  String(
    billLike?.reference ||
      billLike?.id ||
      billLike?.billId ||
      billLike?.invoiceNo ||
      billLike?.invoiceNumber ||
      "",
  ).trim();

const findSupplierBillIndex = (supplier, billId) => {
  const lookup = String(billId || "").trim();
  if (!lookup) return -1;
  return (Array.isArray(supplier?.bills) ? supplier.bills : []).findIndex((bill) => {
    const candidates = [
      String(bill?.id || "").trim(),
      String(bill?.reference || "").trim(),
      getBillReferenceValue(bill),
    ].filter(Boolean);
    return candidates.includes(lookup);
  });
};

const getPurchaseRemainingAmount = (purchase = null) =>
  Math.max(
    Number(
      purchase?.balance ??
        (Number(purchase?.totalAmount || 0) - Number(purchase?.paidAmount || 0))
    ),
    0
  );

const syncSupplierBillWithPurchase = (supplier, purchase, billId = "") => {
  if (!supplier || !purchase) return -1;

  const reference = String(
    billId || purchase?.invoiceNumber || purchase?._id || ""
  ).trim();

  if (!reference) return -1;

  const nextTotalAmount = Number(purchase?.totalAmount || 0);
  const nextPaidAmount = Number(purchase?.paidAmount || 0);
  const nextStatus =
    nextPaidAmount <= 0
      ? "pending"
      : nextPaidAmount >= nextTotalAmount
        ? "paid"
        : "partial";

  const nextBill = {
    ...((Array.isArray(supplier?.bills) ? supplier.bills : [])[findSupplierBillIndex(supplier, reference)]?.toObject?.() ??
      (Array.isArray(supplier?.bills) ? supplier.bills : [])[findSupplierBillIndex(supplier, reference)] ??
      {}),
    id: reference,
    date: normalizeDateString(purchase?.purchaseDate || purchase?.createdAt),
    amount: formatRs(nextTotalAmount),
    paidAmount: formatRs(nextPaidAmount),
    status: nextStatus,
    reference,
  };

  supplier.bills = Array.isArray(supplier?.bills) ? supplier.bills : [];
  const existingBillIndex = findSupplierBillIndex(supplier, reference);

  if (existingBillIndex >= 0) {
    supplier.bills[existingBillIndex] = nextBill;
    return existingBillIndex;
  }

  supplier.bills.push(nextBill);
  return supplier.bills.length - 1;
};

const applyPaymentToSupplierBill = (supplier, billId, paidAmount, paymentMeta) => {
  const billIndex = findSupplierBillIndex(supplier, billId);
  if (billIndex < 0) {
    return { bill: null, billIndex: -1, remaining: null };
  }

  const targetBill = supplier.bills[billIndex];
  const billAmount = parseAmount(targetBill?.amount);
  const currentPaid = parseAmount(targetBill?.paidAmount);
  const remaining = Math.max(billAmount - currentPaid, 0);

  const nextPaid = currentPaid + paidAmount;
  supplier.bills[billIndex] = {
    ...(targetBill.toObject?.() ?? targetBill),
    paidAmount: formatRs(nextPaid),
    status: nextPaid <= 0 ? "pending" : nextPaid >= billAmount ? "paid" : "partial",
    paidDate: paymentMeta.paymentDate,
    paymentMethod: paymentMeta.paymentMethod,
    reference: paymentMeta.reference,
  };

  return {
    bill: supplier.bills[billIndex],
    billIndex,
    remaining,
  };
};

const revertPaymentFromSupplierBill = (supplier, billId, paidAmount) => {
  const billIndex = findSupplierBillIndex(supplier, billId);
  if (billIndex < 0) {
    return null;
  }

  const targetBill = supplier.bills[billIndex];
  const billAmount = parseAmount(targetBill?.amount);
  const currentPaid = parseAmount(targetBill?.paidAmount);
  const nextPaid = Math.max(currentPaid - paidAmount, 0);

  supplier.bills[billIndex] = {
    ...(targetBill.toObject?.() ?? targetBill),
    paidAmount: formatRs(nextPaid),
    status: nextPaid <= 0 ? "pending" : nextPaid >= billAmount ? "paid" : "partial",
    paidDate: nextPaid > 0 ? targetBill?.paidDate || "" : "",
    paymentMethod: nextPaid > 0 ? targetBill?.paymentMethod || "" : "",
    reference: nextPaid > 0 ? targetBill?.reference || "" : "",
  };

  return supplier.bills[billIndex];
};

const syncPurchasePayment = (purchase, paymentId, nextAmount, paymentDate) => {
  const remaining = Math.max(Number(purchase?.totalAmount || 0) - Number(purchase?.paidAmount || 0), 0);
  
  purchase.paidAmount = Number(purchase?.paidAmount || 0) + nextAmount;
  purchase.paymentHistory = Array.isArray(purchase.paymentHistory) ? purchase.paymentHistory : [];
  purchase.paymentHistory.push({
    paymentId,
    appliedAmount: nextAmount,
    appliedAt: paymentDate,
  });
};

const removePurchasePayment = (purchase, paymentId, paidAmount) => {
  purchase.paidAmount = Math.max(Number(purchase?.paidAmount || 0) - Number(paidAmount || 0), 0);
  let removed = false;
  purchase.paymentHistory = (Array.isArray(purchase.paymentHistory) ? purchase.paymentHistory : []).filter((entry) => {
    if (removed) return true;
    if (String(entry?.paymentId || "") === String(paymentId || "")) {
      removed = true;
      return false;
    }
    return true;
  });
};

const findPurchasePaymentEntry = (purchase, paymentId, fallback = {}) => {
  const targetPaymentId = String(paymentId || "").trim();
  const targetAmount = Number(fallback?.paidAmount || 0);
  const targetDate = String(fallback?.paymentDate || "").trim();

  return (Array.isArray(purchase?.paymentHistory) ? purchase.paymentHistory : []).find((entry) => {
    const entryPaymentId = String(entry?.paymentId || entry?._id || entry?.id || "").trim();
    if (targetPaymentId && entryPaymentId === targetPaymentId) {
      return true;
    }

    const entryAmount = Number(entry?.appliedAmount ?? entry?.amount ?? 0);
    const entryDate = normalizeDateString(entry?.appliedAt || entry?.date);

    return (
      targetAmount > 0 &&
      entryAmount === targetAmount &&
      (!targetDate || entryDate === normalizeDateString(targetDate))
    );
  }) || null;
};

const serializePayment = (paymentDoc) => {
  const payment = paymentDoc?.toObject ? paymentDoc.toObject() : paymentDoc || {};
  return {
    ...payment,
    id: String(payment?._id || payment?.id || payment?.paymentId || ""),
    paymentId: String(payment?._id || payment?.id || payment?.paymentId || ""),
    supplierId: payment?.supplierId ? String(payment.supplierId) : "",
    purchaseId: payment?.purchaseId ? String(payment.purchaseId) : "",
    supplierName: payment?.supplierName || payment?.supplier || "",
    supplier: payment?.supplier || payment?.supplierName || "",
    paidAmount: Number(payment?.paidAmount || 0),
    amount: Number(payment?.paidAmount || payment?.amount || 0),
    paymentMethod: payment?.paymentMethod || payment?.method || "Cash",
    method: payment?.paymentMethod || payment?.method || "Cash",
    appliedAt: payment?.appliedAt || payment?.date || "",
    date: payment?.appliedAt || payment?.date || "",
    reference: payment?.reference || "",
    billId: payment?.billId || "",
    notes: payment?.notes || "",
  };
};

const resolveSupplier = async (supplierId, fallbackName = "") => {
  if (supplierId && mongoose.Types.ObjectId.isValid(supplierId)) {
    return Supplier.findById(supplierId);
  }

  const name = String(fallbackName || "").trim();
  if (!name) return null;
  return Supplier.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
};

const getSupplierPayments = async (req, res) => {
  try {
    const supplierId = String(req.params?.supplierId || req.query?.supplierId || "").trim();
    const supplier = await resolveSupplier(supplierId);
    const query = {};

    if (supplier?._id) {
      query.$or = [
        { supplierId: supplier._id },
        { supplier: new RegExp(`^${escapeRegex(supplier.name)}$`, "i") },
        { supplierName: new RegExp(`^${escapeRegex(supplier.name)}$`, "i") },
      ];
    }

    const payments = await SupplierPayment.find(query).sort({ appliedAt: -1, createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      supplierpayments: payments.map((payment) => serializePayment(payment)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier payments",
      error: error.message,
    });
  }
};

const getSupplierPaymentById = async (req, res) => {
  try {
    const paymentId = String(req.params?.id || "").trim();

    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid supplier payment ID is required",
      });
    }

    const payment = await SupplierPayment.findById(paymentId).lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Supplier payment not found",
      });
    }

    res.status(200).json({
      success: true,
      payment: serializePayment(payment),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier payment",
      error: error.message,
    });
  }
};

const createSupplierPayment = async (req, res) => {
  try {
    const supplierId = String(req.body?.supplierId || "").trim();
    const purchaseId = String(req.body?.purchaseId || "").trim();
    const billId = String(req.body?.billId || req.body?.invoiceNumber || "").trim();
    const paymentMethod = String(req.body?.paymentMethod || req.body?.method || "Cash").trim() || "Cash";
    const reference = String(req.body?.reference || "").trim();
    const notes = String(req.body?.notes || "").trim();
    const paymentDate = normalizeDateString(req.body?.paymentDate || req.body?.date);
    const paidAmount = Number(req.body?.paidAmount ?? req.body?.amount ?? 0);

    if (!supplierId || !mongoose.Types.ObjectId.isValid(supplierId)) {
      return res.status(400).json({ success: false, message: "Valid supplier ID is required" });
    }

    if (paidAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid paid amount is required" });
    }

    const supplier = await Supplier.findById(supplierId);
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    let linkedPurchase = null;
    if (purchaseId) {
      if (!mongoose.Types.ObjectId.isValid(purchaseId)) {
        return res.status(400).json({ success: false, message: "Invalid purchase ID" });
      }

      linkedPurchase = await Purchase.findById(purchaseId);
      if (!linkedPurchase) {
        return res.status(404).json({ success: false, message: "Purchase not found" });
      }
    }

    if (billId && linkedPurchase?._id) {
      syncSupplierBillWithPurchase(supplier, linkedPurchase, billId);
    }

    if (billId) {
      const billIndex = findSupplierBillIndex(supplier, billId);
      if (billIndex >= 0) {
        const targetBill = supplier.bills[billIndex];
        const billRemaining = Math.max(
          parseAmount(targetBill?.amount) - parseAmount(targetBill?.paidAmount),
          0,
        );
        const purchaseRemaining = linkedPurchase?._id ? getPurchaseRemainingAmount(linkedPurchase) : billRemaining;
      }
    }

    const paymentRecord = await SupplierPayment.create({
      supplierId: supplier._id,
      supplier: supplier.name,
      supplierName: supplier.name,
      purchaseId: linkedPurchase?._id || null,
      billId,
      paymentMethod,
      reference,
      notes,
      paidAmount,
      appliedAt: paymentDate,
    });

    if (linkedPurchase?._id) {
      syncPurchasePayment(linkedPurchase, paymentRecord._id, paidAmount, paymentDate);
      await linkedPurchase.save();
    }

    if (billId) {
      applyPaymentToSupplierBill(supplier, billId, paidAmount, {
        paymentDate,
        paymentMethod,
        reference,
      });
    }

    recalculateSupplierState(supplier);
    await supplier.save();

    res.status(201).json({
      success: true,
      message: "Payment added successfully",
      payment: serializePayment(paymentRecord),
      supplier: buildSupplierResponse(supplier),
      purchase: linkedPurchase,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to add supplier payment",
      error: error.message,
    });
  }
};

const updateSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentRecord =
      mongoose.Types.ObjectId.isValid(id) ? await SupplierPayment.findById(id) : null;

    const supplierId = String(req.body?.supplierId || paymentRecord?.supplierId || "").trim();
    const supplier =
      (supplierId && mongoose.Types.ObjectId.isValid(supplierId) ? await Supplier.findById(supplierId) : null) ||
      (paymentRecord ? await resolveSupplier(paymentRecord.supplierId, paymentRecord.supplierName || paymentRecord.supplier) : null);

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    if (!paymentRecord) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const previousAmount = Number(paymentRecord?.paidAmount || 0);
    const previousBillId = String(paymentRecord?.billId || "").trim();
    const previousDate = normalizeDateString(paymentRecord?.appliedAt);
    const previousMethod = String(paymentRecord?.paymentMethod || "Cash").trim() || "Cash";
    const previousReference = String(paymentRecord?.reference || "").trim();
    const previousNotes = String(paymentRecord?.notes || "").trim();
    const previousPurchaseId = String(req.body?.previousPurchaseId || paymentRecord?.purchaseId || "").trim();

    const nextAmount = Number(req.body?.paidAmount ?? req.body?.amount ?? previousAmount);
    const nextBillId = String(req.body?.billId || previousBillId).trim();
    const nextDate = normalizeDateString(req.body?.paymentDate || req.body?.date || previousDate);
    const nextMethod = String(req.body?.paymentMethod || req.body?.method || previousMethod).trim() || "Cash";
    const nextReference = String(req.body?.reference ?? previousReference).trim();
    const nextNotes = String(req.body?.notes ?? previousNotes).trim();
    const nextPurchaseId = String(req.body?.purchaseId || previousPurchaseId).trim();

    if (nextAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid paid amount is required" });
    }

    let previousPurchase = null;
    if (previousPurchaseId && mongoose.Types.ObjectId.isValid(previousPurchaseId)) {
      previousPurchase = await Purchase.findById(previousPurchaseId);
    }

    let nextPurchase = previousPurchase;
    if (nextPurchaseId && mongoose.Types.ObjectId.isValid(nextPurchaseId) && String(previousPurchase?._id || "") !== nextPurchaseId) {
      nextPurchase = await Purchase.findById(nextPurchaseId);
    }

    if (previousPurchase?._id) {
      removePurchasePayment(previousPurchase, paymentRecord?._id || id, previousAmount);
    }

    if (previousBillId) {
      revertPaymentFromSupplierBill(supplier, previousBillId, previousAmount);
    }

    if (nextPurchase?._id) {
      syncPurchasePayment(nextPurchase, paymentRecord?._id || id, nextAmount, nextDate);
    }

    if (nextBillId) {
      applyPaymentToSupplierBill(supplier, nextBillId, nextAmount, {
        paymentDate: nextDate,
        paymentMethod: nextMethod,
        reference: nextReference,
      });
    }

    recalculateSupplierState(supplier);

    if (paymentRecord) {
      paymentRecord.billId = nextBillId;
      paymentRecord.purchaseId = nextPurchase?._id || null;
      paymentRecord.paymentMethod = nextMethod;
      paymentRecord.reference = nextReference;
      paymentRecord.notes = nextNotes;
      paymentRecord.paidAmount = nextAmount;
      paymentRecord.appliedAt = nextDate;
      await paymentRecord.save();
    }

    await supplier.save();

    if (previousPurchase?._id) {
      await previousPurchase.save();
    }

    if (nextPurchase?._id && String(nextPurchase?._id || "") !== String(previousPurchase?._id || "")) {
      await nextPurchase.save();
    }

    res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      payment: paymentRecord ? serializePayment(paymentRecord) : serializePayment({
        id,
        supplierId: supplier._id,
        supplier: supplier.name,
        supplierName: supplier.name,
        billId: nextBillId,
        paymentMethod: nextMethod,
        reference: nextReference,
        notes: nextNotes,
        paidAmount: nextAmount,
        appliedAt: nextDate,
        purchaseId: nextPurchase?._id || null,
      }),
      supplier: buildSupplierResponse(supplier),
      purchase: nextPurchase || previousPurchase,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update supplier payment",
      error: error.message,
    });
  }
};

const deleteSupplierPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentRecord =
      mongoose.Types.ObjectId.isValid(id) ? await SupplierPayment.findById(id) : null;
    const supplierId = String(req.body?.supplierId || req.query?.supplierId || paymentRecord?.supplierId || "").trim();
    const requestPaidAmount = Number(req.body?.paidAmount ?? req.query?.paidAmount ?? 0);
    const requestPaymentDate = String(req.body?.paymentDate || req.query?.paymentDate || "").trim();
    const requestBillId = String(req.body?.billId || req.query?.billId || paymentRecord?.billId || "").trim();
    const requestPurchaseId = String(req.body?.purchaseId || req.query?.purchaseId || paymentRecord?.purchaseId || "").trim();
    let linkedPurchase = null;

    if (requestPurchaseId && mongoose.Types.ObjectId.isValid(requestPurchaseId)) {
      linkedPurchase = await Purchase.findById(requestPurchaseId);
    }

    const purchasePaymentEntry = linkedPurchase
      ? findPurchasePaymentEntry(linkedPurchase, paymentRecord?._id || id, {
          paidAmount: requestPaidAmount,
          paymentDate: requestPaymentDate,
        })
      : null;
    const supplier =
      (supplierId && mongoose.Types.ObjectId.isValid(supplierId) ? await Supplier.findById(supplierId) : null) ||
      (paymentRecord ? await resolveSupplier(paymentRecord.supplierId, paymentRecord.supplierName || paymentRecord.supplier) : null);

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    if (!paymentRecord && !purchasePaymentEntry) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const paidAmount = Number(
      paymentRecord?.paidAmount ??
        Number(purchasePaymentEntry?.appliedAmount ?? requestPaidAmount),
    );
    const billId = String(requestBillId || paymentRecord?.billId || "").trim();

    if (linkedPurchase?._id) {
      removePurchasePayment(
        linkedPurchase,
        paymentRecord?._id || purchasePaymentEntry?.paymentId || id,
        paidAmount,
      );
    }

    if (billId) {
      revertPaymentFromSupplierBill(supplier, billId, paidAmount);
    }

    recalculateSupplierState(supplier);

    await supplier.save();

    if (linkedPurchase?._id) {
      await linkedPurchase.save();
    }

    if (paymentRecord?._id) {
      await SupplierPayment.findByIdAndDelete(paymentRecord._id);
    }

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
      supplier: buildSupplierResponse(supplier),
      purchase: linkedPurchase,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete supplier payment",
      error: error.message,
    });
  }
};

export {
  createSupplierPayment,
  deleteSupplierPayment,
  getSupplierPaymentById,
  getSupplierPayments,
  updateSupplierPayment,
};
