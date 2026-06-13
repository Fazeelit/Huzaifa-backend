import mongoose from "mongoose";
import Customer from "../models/customerModel.js";

const hasField = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

const normalizeStringArray = (value) =>
  Array.isArray(value)
    ? [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))]
    : [];

const normalizeBillArray = (value) =>
  Array.isArray(value)
    ? value.map((bill, index) => ({
        id: String(bill?.id || `BILL-${index + 1}`).trim(),
        date: String(bill?.date || "").trim(),
        description: String(bill?.description || "").trim(),
        amount: String(bill?.amount || "").trim(),
        paidAmount: String(bill?.paidAmount || "").trim(),
        status: ["paid", "pending", "overdue"].includes(String(bill?.status || "").toLowerCase())
          ? String(bill.status).toLowerCase()
          : "pending",
        dueDate: String(bill?.dueDate || "").trim(),
        notes: String(bill?.notes || "").trim(),
      }))
    : [];

const normalizePaymentHistory = (value) =>
  Array.isArray(value)
    ? value.map((payment, index) => ({
        id: String(payment?.id || `PAY-${index + 1}`).trim(),
        date: String(payment?.date || "").trim(),
        amount: String(payment?.amount || "").trim(),
        method: String(payment?.method || "").trim(),
        billId: String(payment?.billId || "").trim(),
        notes: String(payment?.notes || "").trim(),
      }))
    : [];

const normalizePayload = (body = {}, options = {}) => {
  const { partial = false } = options;
  const payload = {};

  const setValue = (key, value) => {
    if (!partial || hasField(body, key)) {
      payload[key] = value;
    }
  };

  setValue("name", String(body.name || "").trim());
  setValue("fatherName", String(body.fatherName || "").trim());
  setValue("cnic", String(body.cnic || "").trim());
  setValue("mobile", String(body.mobile || "").trim());
  setValue("email", String(body.email || "").trim());
  setValue("address", String(body.address || "").trim());
  setValue("gender", String(body.gender || "").trim().toLowerCase());
  setValue("customerType", String(body.customerType || "individual").trim().toLowerCase());
  setValue("status", String(body.status || "active").trim().toLowerCase());
  setValue("tags", normalizeStringArray(body.tags));
  setValue("totalPurchases", Number(body.totalPurchases ?? 0) || 0);
  setValue("totalSpent", Number(body.totalSpent ?? 0) || 0);
  setValue("totalDue", Number(body.totalDue ?? 0) || 0);
  setValue("satisfaction", Number(body.satisfaction ?? 0) || 0);
  setValue("lastPurchase", String(body.lastPurchase || "").trim());
  setValue("companyName", String(body.companyName || "").trim());
  setValue("contactPerson", String(body.contactPerson || body.fatherName || "").trim());
  setValue("phone", String(body.phone || body.mobile || "").trim());
  setValue("website", String(body.website || "").trim());
  setValue("taxId", String(body.taxId || "").trim());
  setValue("registeredDate", String(body.registeredDate || "").trim());
  setValue("creditLimit", Number(body.creditLimit ?? 0) || 0);
  setValue("notes", String(body.notes || "").trim());
  setValue("products", normalizeStringArray(body.products));
  setValue("bills", normalizeBillArray(body.bills));
  setValue("paymentHistory", normalizePaymentHistory(body.paymentHistory));

  if (!partial || hasField(body, "bankDetails")) {
    payload.bankDetails = {
      bankName: String(body.bankDetails?.bankName || "").trim(),
      accountTitle: String(body.bankDetails?.accountTitle || "").trim(),
      accountNumber: String(body.bankDetails?.accountNumber || "").trim(),
      iban: String(body.bankDetails?.iban || "").trim(),
      swiftCode: String(body.bankDetails?.swiftCode || "").trim(),
    };
  }

  return payload;
};

const validateCustomerId = (id, res) => {
  if (mongoose.Types.ObjectId.isValid(id)) return true;
  res.status(400).json({ success: false, message: "Invalid customer ID" });
  return false;
};

const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 }).lean();
    res.status(200).json({
      success: true,
      customers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch customers",
      error: error.message,
    });
  }
};

const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateCustomerId(id, res)) return;

    const customer = await Customer.findById(id).lean();
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      customer,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch customer",
      error: error.message,
    });
  }
};

const createCustomer = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const customer = await Customer.create(payload);

    return res.status(201).json({
      success: true,
      message: "Customer created successfully",
      customer,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Customer with this CNIC already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0]?.message || "Validation failed",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to create customer",
      error: error.message,
    });
  }
};

const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateCustomerId(id, res)) return;

    const payload = normalizePayload(req.body, { partial: true });
    const customer = await Customer.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer updated successfully",
      customer,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "Customer with this CNIC already exists",
      });
    }

    if (error.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors)[0]?.message || "Validation failed",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to update customer",
      error: error.message,
    });
  }
};

const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    if (!validateCustomerId(id, res)) return;

    const customer = await Customer.findByIdAndDelete(id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: "Customer not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Customer deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete customer",
      error: error.message,
    });
  }
};

export {
  createCustomer,
  deleteCustomer,
  getAllCustomers,
  getCustomerById,
  updateCustomer,
};
