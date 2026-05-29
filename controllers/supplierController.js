
import Supplier from "../models/supplierModel.js";
import Purchase from "../models/purchaseModel.js";
import mongoose from "mongoose";

const parseAmount = (value) => {
  if (typeof value === "number") return value;
  const cleaned = String(value || "").replace(/[^0-9.-]/g, "");
  return cleaned ? Number(cleaned) : 0;
};

const formatRs = (value) => `Rs. ${Number(value || 0).toLocaleString("en-IN")}`;

const escapeRegex = (value = "") =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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

const buildStatisticsFromPurchases = (purchases = []) => {
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

  purchases.forEach((purchase) => {
    const totalAmount = Number(purchase?.totalAmount || 0);
    const paidAmount = Number(purchase?.paidAmount || 0);
    const pendingAmount =
      Number(purchase?.balance || 0) || Math.max(totalAmount - paidAmount, 0);
    const paymentStatus = String(purchase?.paymentStatus || "").toLowerCase();
    const purchaseDate = purchase?.purchaseDate
      ? new Date(purchase.purchaseDate).toISOString().split("T")[0]
      : "";

    summary.totalBills += 1;
    summary.totalAmount += totalAmount;
    summary.paidAmount += paidAmount;
    summary.pendingAmount += pendingAmount;

    if (paymentStatus === "paid") {
      summary.paidBills += 1;
    } else if (pendingAmount > 0) {
      summary.pendingBills += 1;
    }

    if (purchaseDate && (!summary.lastPaymentDate || purchaseDate > summary.lastPaymentDate)) {
      summary.lastPaymentDate = purchaseDate;
    }
  });

  return {
    ...summary,
    totalAmount: formatRs(summary.totalAmount),
    paidAmount: formatRs(summary.paidAmount),
    pendingAmount: formatRs(summary.pendingAmount),
    overdueAmount: formatRs(summary.overdueAmount),
  };
};

const hasMeaningfulStatistics = (statistics = {}) =>
  Number(statistics?.totalBills || 0) > 0 ||
  parseAmount(statistics?.totalAmount) > 0 ||
  parseAmount(statistics?.paidAmount) > 0 ||
  parseAmount(statistics?.pendingAmount) > 0 ||
  parseAmount(statistics?.overdueAmount) > 0;

const enrichSupplierRecords = async (suppliers) => {
  const purchases = await Purchase.find(
    {},
    {
      supplier: 1,
      totalAmount: 1,
      paidAmount: 1,
      balance: 1,
      paymentStatus: 1,
      purchaseDate: 1,
    }
  ).lean();

  return suppliers.map((supplierDoc) => {
    const supplier = supplierDoc.toObject ? supplierDoc.toObject() : supplierDoc;
    const supplierName = String(supplier?.name || "").trim();
    const bills = Array.isArray(supplier?.bills) ? supplier.bills : [];
    const statistics = supplier?.statistics || {};

    const matchedPurchases = supplierName
      ? purchases.filter((purchase) =>
          new RegExp(`^${escapeRegex(supplierName)}$`, "i").test(
            String(purchase?.supplier || "").trim()
          )
        )
      : [];

    const derivedStatistics = bills.length
      ? buildStatisticsFromBills(bills)
      : buildStatisticsFromPurchases(matchedPurchases);

    return {
      ...supplier,
      phone: supplier?.phone || supplier?.mobile || "",
      purchaseCount: matchedPurchases.length,
      statistics: hasMeaningfulStatistics(statistics)
        ? { ...derivedStatistics, ...statistics }
        : derivedStatistics,
    };
  });
};

const recalculateSupplierStatistics = (supplier) => {
  const bills = Array.isArray(supplier?.bills) ? supplier.bills : [];
  return buildStatisticsFromBills(bills);
};

const normalizeSupplierPayload = (body = {}) => {
  const phone = String(body.phone || "").trim();
  const address = String(body.address || "").trim();
  const companyName = String(body.companyName || body.company || "").trim();
  const productsSupplied = Array.isArray(body.productsSupplied)
    ? body.productsSupplied
    : Array.isArray(body.products)
      ? body.products
      : [];

  return {
    supplierId:
      String(body.supplierId || "").trim() ||
      `SUP-${Date.now().toString().slice(-6)}`,
    name: String(body.name || "").trim(),
    contactPerson: String(body.contactPerson || "").trim(),
    phone,
    email: String(body.email || "").trim().toLowerCase(),
    address: address || "N/A",
    companyName,
    productsSupplied,
    paymentTerms: String(body.paymentTerms || "Cash").trim(),
    status: String(body.status || "active").trim(),
    notes: String(body.notes || "").trim(),
  };
};

// Create a new supplier
const createSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);
    const {
      supplierId,
      name,
      contactPerson,
      phone,
      email,
      address,
      companyName,
      productsSupplied,
      paymentTerms,
      status,
      notes,
    } = payload;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name and phone are required",
      });
    }

    // Check for duplicate supplierId
    const existingSupplier = await Supplier.findOne({ supplierId });
    if (existingSupplier) {
      return res.status(400).json({
        success: false,
        message: "Supplier ID already exists",
      });
    }

    const supplier = new Supplier({
      supplierId,
      name,
      contactPerson,
      phone,
      email,
      address,
      companyName,
      productsSupplied,
      paymentTerms,      
      status,
      notes,
    });

    const savedSupplier = await supplier.save();
    res.status(201).json({
      success: true,
      message: "Supplier created successfully",
      supplier: savedSupplier,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// Get all suppliers
const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find().sort({ createdAt: -1 });
    const enrichedSuppliers = await enrichSupplierRecords(suppliers);
    res.status(200).json({
      success: true,
      suppliers: enrichedSuppliers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Get a single supplier by ID
const getSupplierById = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }
    res.status(200).json({
      success: true,
      supplier,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
};

const paySupplierBill = async (req, res) => {
  try {
    const { id, billId } = req.params;
    const paidAmount = Number(req.body?.paidAmount || 0);
    const paymentMethod = String(req.body?.paymentMethod || "").trim();
    const reference = String(req.body?.reference || "").trim();
    const paymentDate =
      String(req.body?.paymentDate || "").trim() || new Date().toISOString().split("T")[0];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    }

    if (!billId || paidAmount <= 0) {
      return res.status(400).json({ success: false, message: "Bill ID and valid paid amount are required" });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    const targetBill = supplier.bills.find((bill) => String(bill?.id || "") === String(billId));
    if (!targetBill) {
      return res.status(404).json({ success: false, message: "Bill not found" });
    }

    const billAmount = parseAmount(targetBill.amount);
    const currentPaid = parseAmount(targetBill.paidAmount);
    const remainingAmount = Math.max(billAmount - currentPaid, 0);

    if (paidAmount > remainingAmount) {
      return res.status(400).json({ success: false, message: "Paid amount cannot exceed remaining amount" });
    }

    const nextPaid = currentPaid + paidAmount;
    targetBill.paidAmount = formatRs(nextPaid);
    targetBill.status = nextPaid >= billAmount ? "paid" : "partial";
    targetBill.paidDate = paymentDate;
    targetBill.paymentMethod = paymentMethod;
    targetBill.reference = reference;

    supplier.paymentHistory = [
      {
        id: `PAY-${Date.now().toString().slice(-6)}`,
        date: paymentDate,
        amount: formatRs(paidAmount),
        method: paymentMethod,
        reference,
        billId: String(targetBill.id || ""),
        notes: "",
      },
      ...(Array.isArray(supplier.paymentHistory) ? supplier.paymentHistory : []),
    ];
    supplier.statistics = recalculateSupplierStatistics(supplier);

    await supplier.save();

    res.status(200).json({
      success: true,
      message: "Supplier bill payment applied successfully",
      supplier,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to apply supplier bill payment",
      error: error.message,
    });
  }
};

const payAllSupplierBills = async (req, res) => {
  try {
    const { id } = req.params;
    const incomingAmount = Number(req.body?.paidAmount || 0);
    const paymentMethod = String(req.body?.paymentMethod || "").trim();
    const reference = String(req.body?.reference || "").trim();
    const paymentDate =
      String(req.body?.paymentDate || "").trim() || new Date().toISOString().split("T")[0];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid supplier ID" });
    }

    if (incomingAmount <= 0) {
      return res.status(400).json({ success: false, message: "Valid paid amount is required" });
    }

    const supplier = await Supplier.findById(id);
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    const unpaidBills = supplier.bills.filter((bill) => String(bill?.status || "").toLowerCase() !== "paid");
    if (!unpaidBills.length) {
      return res.status(404).json({ success: false, message: "No unpaid supplier bills found" });
    }

    let remaining = incomingAmount;
    let appliedTotal = 0;

    supplier.bills = supplier.bills.map((bill) => {
      if (remaining <= 0 || String(bill?.status || "").toLowerCase() === "paid") {
        return bill;
      }

      const billAmount = parseAmount(bill.amount);
      const currentPaid = parseAmount(bill.paidAmount);
      const due = Math.max(billAmount - currentPaid, 0);
      const applied = Math.min(due, remaining);
      const nextPaid = currentPaid + applied;

      remaining -= applied;
      appliedTotal += applied;

      return {
        ...bill.toObject?.() ?? bill,
        paidAmount: formatRs(nextPaid),
        status: nextPaid >= billAmount ? "paid" : "partial",
        paidDate: applied > 0 ? paymentDate : bill.paidDate,
        paymentMethod: applied > 0 ? paymentMethod : bill.paymentMethod,
        reference: applied > 0 ? reference : bill.reference,
      };
    });

    if (appliedTotal <= 0) {
      return res.status(400).json({ success: false, message: "Unable to apply payment to supplier bills" });
    }

    supplier.paymentHistory = [
      {
        id: `PAY-${Date.now().toString().slice(-6)}`,
        date: paymentDate,
        amount: formatRs(appliedTotal),
        method: paymentMethod,
        reference,
        billId: "ALL-BILLS",
        notes: "Full supplier bill payment",
      },
      ...(Array.isArray(supplier.paymentHistory) ? supplier.paymentHistory : []),
    ];
    supplier.statistics = recalculateSupplierStatistics(supplier);

    await supplier.save();

    res.status(200).json({
      success: true,
      message: "All supplier bills payment applied successfully",
      supplier,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to apply total supplier bill payment",
      error: error.message,
    });
  }
};


// Update a supplier
const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔍 Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid supplier ID" });
    }

    // 🔒 Prevent updating supplierId
    const { supplierId, ...updateData } = normalizeSupplierPayload(req.body);

    const supplier = await Supplier.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.status(200).json({
      success: true,
      message: "Supplier updated successfully",
      supplier,
    });

  } catch (error) {
    console.error("❌ Update Supplier Error:", error.message);
    console.error(error); // FULL stack trace
    res.status(500).json({
      message: "Server Error",
      error: error.message, // TEMP: remove in production
    });
  }
};


// Delete a supplier
const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    const supplier = await Supplier.findByIdAndDelete(id);

    if (!supplier) {
      return res.status(404).json({ message: "Supplier not found" });
    }

    res.status(200).json({
      success: true,
      message: "Supplier deleted successfully",
    });
  } catch (error) {
    console.error("Delete Supplier Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

export default deleteSupplier;


// Export all controller functions at the end
export {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  paySupplierBill,
  payAllSupplierBills,
  deleteSupplier,
};
