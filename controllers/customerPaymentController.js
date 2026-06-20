import mongoose from "mongoose";
import Customer from "../models/customerModel.js";
import Sale from "../models/salesModel.js";
import CustomerPayment from "../models/customerPaymentModel.js";

const parseAmount = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  const parsed = cleaned ? Number(cleaned) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
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

const buildCustomerResponse = (customerDoc) => {
  const customer = customerDoc?.toObject ? customerDoc.toObject() : customerDoc || {};
  return {
    ...customer,
    phone: customer?.phone || customer?.mobile || "",
    mobile: customer?.mobile || customer?.phone || "",
    company: customer?.companyName || customer?.company || "",
    products: Array.isArray(customer?.products) ? customer.products : [],
    openingBalance: Number(customer?.openingBalance ?? 0) || 0,
    creditLimit: Number(customer?.creditLimit ?? 0) || 0,
    preferred: Boolean(customer?.preferred),
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

const recalculateCustomerState = (customer) => {
  const bills = Array.isArray(customer?.bills) ? customer.bills : [];
  customer.statistics = buildStatisticsFromBills(bills);
  customer.totalDue = bills.reduce(
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

const findCustomerBillIndex = (customer, billId) => {
  const lookup = String(billId || "").trim();
  if (!lookup) return -1;
  return (Array.isArray(customer?.bills) ? customer.bills : []).findIndex((bill) => {
    const candidates = [
      String(bill?.id || "").trim(),
      String(bill?.reference || "").trim(),
      getBillReferenceValue(bill),
    ].filter(Boolean);
    return candidates.includes(lookup);
  });
};

const applyPaymentToCustomerBill = (customer, billId, paidAmount, paymentMeta) => {
  const billIndex = findCustomerBillIndex(customer, billId);
  if (billIndex < 0) {
    return { bill: null, billIndex: -1, remaining: null };
  }

  const targetBill = customer.bills[billIndex];
  const billAmount = parseAmount(targetBill?.amount);
  const currentPaid = parseAmount(targetBill?.paidAmount);
  const remaining = Math.max(billAmount - currentPaid, 0);

  const nextPaid = currentPaid + paidAmount;
  customer.bills[billIndex] = {
    ...(targetBill.toObject?.() ?? targetBill),
    paidAmount: formatRs(nextPaid),
    status: nextPaid <= 0 ? "pending" : nextPaid >= billAmount ? "paid" : "partial",
    paidDate: paymentMeta.paymentDate,
    paymentMethod: paymentMeta.paymentMethod,
    reference: paymentMeta.reference,
  };

  return {
    bill: customer.bills[billIndex],
    billIndex,
    remaining,
  };
};

const revertPaymentFromCustomerBill = (customer, billId, paidAmount) => {
  const billIndex = findCustomerBillIndex(customer, billId);
  if (billIndex < 0) {
    return null;
  }

  const targetBill = customer.bills[billIndex];
  const billAmount = parseAmount(targetBill?.amount);
  const currentPaid = parseAmount(targetBill?.paidAmount);
  const nextPaid = Math.max(currentPaid - paidAmount, 0);

  customer.bills[billIndex] = {
    ...(targetBill.toObject?.() ?? targetBill),
    paidAmount: formatRs(nextPaid),
    status: nextPaid <= 0 ? "pending" : nextPaid >= billAmount ? "paid" : "partial",
    paidDate: nextPaid > 0 ? targetBill?.paidDate || "" : "",
    paymentMethod: nextPaid > 0 ? targetBill?.paymentMethod || "" : "",
    reference: nextPaid > 0 ? targetBill?.reference || "" : "",
  };

  return customer.bills[billIndex];
};

const syncSalePayment = (sale, paymentId, nextAmount, paymentDate, paymentMethod, reference) => {
  sale.paidAmount = Number(sale?.paidAmount || 0) + nextAmount;
  sale.paymentHistory = Array.isArray(sale.paymentHistory) ? sale.paymentHistory : [];
  sale.paymentHistory.push({
    paymentId,
    amount: nextAmount,
    method: paymentMethod,
    reference,
    date: paymentDate,
  });
};

const removeSalePayment = (sale, paymentId, fallback = {}) => {
  sale.paidAmount = Math.max(Number(sale?.paidAmount || 0) - Number(fallback?.paidAmount || 0), 0);
  let removed = false;

  sale.paymentHistory = (Array.isArray(sale.paymentHistory) ? sale.paymentHistory : []).filter((entry) => {
    if (removed) return true;

    const entryPaymentId = String(entry?.paymentId || entry?._id || entry?.id || "").trim();
    const matchesId = paymentId && entryPaymentId === String(paymentId || "").trim();
    const matchesFallback =
      !matchesId &&
      Number(entry?.amount ?? entry?.appliedAmount ?? 0) === Number(fallback?.paidAmount || 0) &&
      normalizeDateString(entry?.date || entry?.appliedAt) === normalizeDateString(fallback?.paymentDate) &&
      String(entry?.reference || "").trim() === String(fallback?.reference || "").trim();

    if (matchesId || matchesFallback) {
      removed = true;
      return false;
    }

    return true;
  });
};

const findSalePaymentEntry = (sale, paymentId, fallback = {}) => {
  const targetPaymentId = String(paymentId || "").trim();
  const targetAmount = Number(fallback?.paidAmount || 0);
  const targetDate = String(fallback?.paymentDate || "").trim();
  const targetReference = String(fallback?.reference || "").trim();

  return (Array.isArray(sale?.paymentHistory) ? sale.paymentHistory : []).find((entry) => {
    const entryPaymentId = String(entry?.paymentId || entry?._id || entry?.id || "").trim();
    if (targetPaymentId && entryPaymentId === targetPaymentId) {
      return true;
    }

    const entryAmount = Number(entry?.amount ?? entry?.appliedAmount ?? 0);
    const entryDate = normalizeDateString(entry?.date || entry?.appliedAt);
    const entryReference = String(entry?.reference || "").trim();

    return (
      targetAmount > 0 &&
      entryAmount === targetAmount &&
      (!targetDate || entryDate === normalizeDateString(targetDate)) &&
      (!targetReference || entryReference === targetReference)
    );
  }) || null;
};

const serializePayment = (paymentDoc) => {
  const payment = paymentDoc?.toObject ? paymentDoc.toObject() : paymentDoc || {};
  return {
    ...payment,
    id: String(payment?._id || payment?.id || payment?.paymentId || ""),
    paymentId: String(payment?._id || payment?.id || payment?.paymentId || ""),
    customerId: payment?.customerId ? String(payment.customerId) : "",
    saleId: payment?.saleId ? String(payment.saleId) : "",
    customerName: payment?.customerName || payment?.customer || "",
    customer: payment?.customer || payment?.customerName || "",
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

const resolveCustomer = async (customerId, fallbackName = "") => {
  if (customerId && mongoose.Types.ObjectId.isValid(customerId)) {
    return Customer.findById(customerId);
  }

  const name = String(fallbackName || "").trim();
  if (!name) return null;
  return Customer.findOne({ name: new RegExp(`^${escapeRegex(name)}$`, "i") });
};

const getCustomerPayments = async (req, res) => {
  try {
    const customerId = String(req.params?.customerId || req.query?.customerId || "").trim();
    const customer = await resolveCustomer(customerId);
    const query = {};

    if (customer?._id) {
      query.$or = [
        { customerId: customer._id },
        { customer: new RegExp(`^${escapeRegex(customer.name)}$`, "i") },
        { customerName: new RegExp(`^${escapeRegex(customer.name)}$`, "i") },
      ];
    }

    const payments = await CustomerPayment.find(query).sort({ appliedAt: -1, createdAt: -1 }).lean();

    res.status(200).json({
      success: true,
      customerpayments: payments.map((payment) => serializePayment(payment)),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer payments",
      error: error.message,
    });
  }
};

const getCustomerPaymentById = async (req, res) => {
  try {
    const paymentId = String(req.params?.id || "").trim();

    if (!paymentId || !mongoose.Types.ObjectId.isValid(paymentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid customer payment ID is required",
      });
    }

    const payment = await CustomerPayment.findById(paymentId).lean();

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Customer payment not found",
      });
    }

    res.status(200).json({
      success: true,
      payment: serializePayment(payment),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customer payment",
      error: error.message,
    });
  }
};

const createCustomerPayment = async (req, res) => {
  try {
    const customerId = String(req.body?.customerId || "").trim();
    const saleId = String(req.body?.saleId || "").trim();
    const billId = String(req.body?.billId || req.body?.invoiceNumber || "").trim();
    const paymentMethod = String(req.body?.paymentMethod || req.body?.method || "Cash").trim() || "Cash";
    const reference = String(req.body?.reference || "").trim();
    const notes = String(req.body?.notes || "").trim();
    const paymentDate = normalizeDateString(req.body?.paymentDate || req.body?.date);
    const paidAmount = Number(req.body?.paidAmount ?? req.body?.amount ?? 0);

    if (!customerId || !mongoose.Types.ObjectId.isValid(customerId)) {
      return res.status(400).json({ success: false, message: "Valid customer ID is required" });
    }

    if (paidAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid paid amount is required" });
    }

    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    let linkedSale = null;
    if (saleId) {
      if (!mongoose.Types.ObjectId.isValid(saleId)) {
        return res.status(400).json({ success: false, message: "Invalid sale ID" });
      }

      linkedSale = await Sale.findById(saleId);
      if (!linkedSale) {
        return res.status(404).json({ success: false, message: "Sale not found" });
      }

    }

    const paymentRecord = await CustomerPayment.create({
      customerId: customer._id,
      customer: customer.name,
      customerName: customer.name,
      saleId: linkedSale?._id || null,
      billId,
      paymentMethod,
      reference,
      notes,
      paidAmount,
      appliedAt: paymentDate,
    });

    if (linkedSale?._id) {
      syncSalePayment(linkedSale, paymentRecord._id, paidAmount, paymentDate, paymentMethod, reference);
      await linkedSale.save();
    }

    if (billId) {
      applyPaymentToCustomerBill(customer, billId, paidAmount, {
        paymentDate,
        paymentMethod,
        reference,
      });
    }

    recalculateCustomerState(customer);
    await customer.save();

    res.status(201).json({
      success: true,
      message: "Payment added successfully",
      payment: serializePayment(paymentRecord),
      customer: buildCustomerResponse(customer),
      sale: linkedSale,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to add customer payment",
      error: error.message,
    });
  }
};

const updateCustomerPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentRecord =
      mongoose.Types.ObjectId.isValid(id) ? await CustomerPayment.findById(id) : null;

    const customerId = String(req.body?.customerId || paymentRecord?.customerId || "").trim();
    const customer =
      (customerId && mongoose.Types.ObjectId.isValid(customerId) ? await Customer.findById(customerId) : null) ||
      (paymentRecord
        ? await resolveCustomer(paymentRecord.customerId, paymentRecord.customerName || paymentRecord.customer)
        : null);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
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
    const previousSaleId = String(req.body?.previousSaleId || paymentRecord?.saleId || "").trim();

    const nextAmount = Number(req.body?.paidAmount ?? req.body?.amount ?? previousAmount);
    const nextBillId = String(req.body?.billId || previousBillId).trim();
    const nextDate = normalizeDateString(req.body?.paymentDate || req.body?.date || previousDate);
    const nextMethod = String(req.body?.paymentMethod || req.body?.method || previousMethod).trim() || "Cash";
    const nextReference = String(req.body?.reference ?? previousReference).trim();
    const nextNotes = String(req.body?.notes ?? previousNotes).trim();
    const nextSaleId = String(req.body?.saleId || previousSaleId).trim();

    if (nextAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid paid amount is required" });
    }

    let previousSale = null;
    if (previousSaleId && mongoose.Types.ObjectId.isValid(previousSaleId)) {
      previousSale = await Sale.findById(previousSaleId);
    }

    let nextSale = previousSale;
    if (nextSaleId && mongoose.Types.ObjectId.isValid(nextSaleId) && String(previousSale?._id || "") !== nextSaleId) {
      nextSale = await Sale.findById(nextSaleId);
    }

    if (previousSale?._id) {
      removeSalePayment(previousSale, paymentRecord?._id || id, {
        paidAmount: previousAmount,
        paymentDate: previousDate,
        reference: previousReference,
      });
    }

    if (previousBillId) {
      revertPaymentFromCustomerBill(customer, previousBillId, previousAmount);
    }

    if (nextSale?._id) {
      syncSalePayment(nextSale, paymentRecord?._id || id, nextAmount, nextDate, nextMethod, nextReference);
    }

    if (nextBillId) {
      applyPaymentToCustomerBill(customer, nextBillId, nextAmount, {
        paymentDate: nextDate,
        paymentMethod: nextMethod,
        reference: nextReference,
      });
    }

    recalculateCustomerState(customer);

    paymentRecord.billId = nextBillId;
    paymentRecord.saleId = nextSale?._id || null;
    paymentRecord.paymentMethod = nextMethod;
    paymentRecord.reference = nextReference;
    paymentRecord.notes = nextNotes;
    paymentRecord.paidAmount = nextAmount;
    paymentRecord.appliedAt = nextDate;
    await paymentRecord.save();

    await customer.save();

    if (previousSale?._id) {
      await previousSale.save();
    }

    if (nextSale?._id && String(nextSale?._id || "") !== String(previousSale?._id || "")) {
      await nextSale.save();
    }

    res.status(200).json({
      success: true,
      message: "Payment updated successfully",
      payment: serializePayment(paymentRecord),
      customer: buildCustomerResponse(customer),
      sale: nextSale || previousSale,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to update customer payment",
      error: error.message,
    });
  }
};

const deleteCustomerPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const paymentRecord =
      mongoose.Types.ObjectId.isValid(id) ? await CustomerPayment.findById(id) : null;
    const customerId = String(req.body?.customerId || req.query?.customerId || paymentRecord?.customerId || "").trim();
    const requestPaidAmount = Number(req.body?.paidAmount ?? req.query?.paidAmount ?? 0);
    const requestPaymentDate = String(req.body?.paymentDate || req.query?.paymentDate || "").trim();
    const requestReference = String(req.body?.reference || req.query?.reference || paymentRecord?.reference || "").trim();
    const requestBillId = String(req.body?.billId || req.query?.billId || paymentRecord?.billId || "").trim();
    const requestSaleId = String(req.body?.saleId || req.query?.saleId || paymentRecord?.saleId || "").trim();
    let linkedSale = null;

    if (requestSaleId && mongoose.Types.ObjectId.isValid(requestSaleId)) {
      linkedSale = await Sale.findById(requestSaleId);
    }

    const salePaymentEntry = linkedSale
      ? findSalePaymentEntry(linkedSale, paymentRecord?._id || id, {
          paidAmount: requestPaidAmount,
          paymentDate: requestPaymentDate,
          reference: requestReference,
        })
      : null;

    const customer =
      (customerId && mongoose.Types.ObjectId.isValid(customerId) ? await Customer.findById(customerId) : null) ||
      (paymentRecord
        ? await resolveCustomer(paymentRecord.customerId, paymentRecord.customerName || paymentRecord.customer)
        : null);

    if (!customer) {
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    if (!paymentRecord && !salePaymentEntry) {
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const paidAmount = Number(
      paymentRecord?.paidAmount ??
        Number(salePaymentEntry?.amount ?? requestPaidAmount),
    );
    const billId = String(requestBillId || paymentRecord?.billId || "").trim();

    if (linkedSale?._id) {
      removeSalePayment(linkedSale, paymentRecord?._id || id, {
        paidAmount,
        paymentDate: requestPaymentDate || paymentRecord?.appliedAt,
        reference: requestReference,
      });
    }

    if (billId) {
      revertPaymentFromCustomerBill(customer, billId, paidAmount);
    }

    recalculateCustomerState(customer);

    await customer.save();

    if (linkedSale?._id) {
      await linkedSale.save();
    }

    if (paymentRecord?._id) {
      await CustomerPayment.findByIdAndDelete(paymentRecord._id);
    }

    res.status(200).json({
      success: true,
      message: "Payment deleted successfully",
      customer: buildCustomerResponse(customer),
      sale: linkedSale,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message || "Failed to delete customer payment",
      error: error.message,
    });
  }
};

export {
  createCustomerPayment,
  deleteCustomerPayment,
  getCustomerPaymentById,
  getCustomerPayments,
  updateCustomerPayment,
};
