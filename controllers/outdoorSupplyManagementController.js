import mongoose from "mongoose";
import {
  OutdoorSupplier,
  OutdoorSupply,
} from "../models/outdoorSupplyManagementModel.js";

const hasField = (body, key) => Object.prototype.hasOwnProperty.call(body, key);

const normalizeObjectId = (value) =>
  mongoose.Types.ObjectId.isValid(String(value || "").trim())
    ? new mongoose.Types.ObjectId(String(value).trim())
    : null;

const normalizeOutdoorSupplierPayload = (body = {}, options = {}) => {
  const { partial = false } = options;
  const payload = {};

  const setValue = (key, value) => {
    if (!partial || hasField(body, key)) {
      payload[key] = value;
    }
  };

  setValue("supplierName", String(body.supplierName || "").trim());
  setValue("phoneNo", String(body.phoneNo || "").trim());
  setValue("gariNo", String(body.gariNo || "").trim());
  setValue("routeName", String(body.routeName || "").trim());
  setValue("monthlyPay", Number(body.monthlyPay || 0));
  setValue("commission", Number(body.commission || 0));
  setValue("address", String(body.address || "").trim());
  setValue("notes", String(body.notes || "").trim());

  return payload;
};

const normalizeOutdoorSupplyItems = (items = []) =>
  (Array.isArray(items) ? items : []).map((item) => {
    const receivedQuantity = Math.max(Number(item?.receivedQuantity || 0), 0);
    const returnedQuantity = Math.max(Number(item?.returnedQuantity || 0), 0);
    const saleQuantity = Math.max(receivedQuantity - returnedQuantity, 0);
    const price = Math.max(Number(item?.price || 0), 0);

    return {
      productId: String(item?.productId || "").trim(),
      productName: String(item?.productName || "").trim(),
      manufacturer: String(item?.manufacturer || "").trim(),
      receivedQuantity,
      returnedQuantity,
      saleQuantity,
      price,
      totalPrice: Number((saleQuantity * price).toFixed(2)),
    };
  });

const normalizeOutdoorSupplyPayload = (body = {}, options = {}) => {
  const { partial = false } = options;
  const payload = {};

  const setValue = (key, value) => {
    if (!partial || hasField(body, key)) {
      payload[key] = value;
    }
  };

  const normalizedSupplierId = normalizeObjectId(body.supplierId);
  const normalizedItems = normalizeOutdoorSupplyItems(body.items);
  const computedTotalBill = Number(
    normalizedItems
      .reduce((sum, item) => sum + Number(item.totalPrice || 0), 0)
      .toFixed(2)
  );

  setValue("supplierId", normalizedSupplierId);
  setValue("supplierName", String(body.supplierName || "").trim());
  setValue("routeName", String(body.routeName || "").trim());
  setValue("invoiceNumber", String(body.invoiceNumber || "").trim());
  setValue("supplyDate", body.supplyDate ? new Date(body.supplyDate) : null);
  setValue("items", normalizedItems);
  setValue("totalBill", computedTotalBill);
  setValue("createdSaleId", String(body.createdSaleId || "").trim());
  setValue("createdSaleInvoiceNo", String(body.createdSaleInvoiceNo || "").trim());

  return payload;
};

const validateOutdoorSupplierPayload = (payload) => {
  if (!payload.supplierName || !payload.phoneNo || !payload.gariNo || !payload.routeName) {
    return "Supplier name, phone number, gari number, and route name are required";
  }

  if (Number(payload.monthlyPay || 0) <= 0 || Number(payload.commission || 0) <= 0) {
    return "Monthly pay and commission must be greater than 0";
  }

  return "";
};

const validateOutdoorSupplyPayload = (payload) => {
  if (!payload.supplierId) {
    return "Valid outdoor supplier is required";
  }

  if (!payload.supplierName || !payload.invoiceNumber || !payload.supplyDate) {
    return "Supplier name, invoice number, and supply date are required";
  }

  if (Number.isNaN(payload.supplyDate.getTime())) {
    return "Supply date is invalid";
  }

  if (!Array.isArray(payload.items) || !payload.items.length) {
    return "At least one outdoor supply item is required";
  }

  for (const item of payload.items) {
    if (!item.productName || !item.manufacturer) {
      return "Each item must include product name and manufacturer";
    }

    if (Number(item.receivedQuantity || 0) <= 0) {
      return "Each item must include received quantity greater than 0";
    }

    if (Number(item.returnedQuantity || 0) > Number(item.receivedQuantity || 0)) {
      return "Returned quantity cannot exceed received quantity";
    }

    if (Number(item.price || 0) <= 0) {
      return "Each item must include price greater than 0";
    }

    if (Number(item.saleQuantity || 0) <= 0) {
      return "Each item must have sale quantity greater than 0";
    }
  }

  return "";
};

const getOutdoorSuppliers = async (req, res) => {
  try {
    const suppliers = await OutdoorSupplier.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: suppliers.length,
      data: suppliers,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch outdoor suppliers",
      error: error.message,
    });
  }
};

const getOutdoorSupplierById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid outdoor supplier ID" });
    }

    const supplier = await OutdoorSupplier.findById(id);

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Outdoor supplier not found" });
    }

    res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch outdoor supplier",
      error: error.message,
    });
  }
};

const createOutdoorSupplier = async (req, res) => {
  try {
    const payload = normalizeOutdoorSupplierPayload(req.body);
    const validationMessage = validateOutdoorSupplierPayload(payload);

    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const supplier = await OutdoorSupplier.create(payload);

    res.status(201).json({
      success: true,
      message: "Outdoor supplier created successfully",
      data: supplier,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to create outdoor supplier",
      error: error.message,
    });
  }
};

const updateOutdoorSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid outdoor supplier ID" });
    }

    const payload = normalizeOutdoorSupplierPayload(req.body, { partial: true });
    const existingSupplier = await OutdoorSupplier.findById(id);

    if (!existingSupplier) {
      return res.status(404).json({ success: false, message: "Outdoor supplier not found" });
    }

    Object.assign(existingSupplier, payload);

    const validationMessage = validateOutdoorSupplierPayload(existingSupplier.toObject());
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    await existingSupplier.save();

    res.status(200).json({
      success: true,
      message: "Outdoor supplier updated successfully",
      data: existingSupplier,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: "Failed to update outdoor supplier",
      error: error.message,
    });
  }
};

const deleteOutdoorSupplier = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid outdoor supplier ID" });
    }

    const linkedSupply = await OutdoorSupply.findOne({ supplierId: id }).lean();
    if (linkedSupply) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete outdoor supplier while supply bills exist for it",
      });
    }

    const supplier = await OutdoorSupplier.findByIdAndDelete(id);

    if (!supplier) {
      return res.status(404).json({ success: false, message: "Outdoor supplier not found" });
    }

    res.status(200).json({
      success: true,
      message: "Outdoor supplier deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete outdoor supplier",
      error: error.message,
    });
  }
};

const getOutdoorSupplies = async (req, res) => {
  try {
    const supplies = await OutdoorSupply.find()
      .populate("supplierId", "supplierName phoneNo gariNo routeName monthlyPay commission")
      .sort({ supplyDate: -1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: supplies.length,
      data: supplies,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch outdoor supplies",
      error: error.message,
    });
  }
};

const getOutdoorSupplyById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid outdoor supply ID" });
    }

    const supply = await OutdoorSupply.findById(id).populate(
      "supplierId",
      "supplierName phoneNo gariNo routeName monthlyPay commission"
    );

    if (!supply) {
      return res.status(404).json({ success: false, message: "Outdoor supply not found" });
    }

    res.status(200).json({ success: true, data: supply });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch outdoor supply",
      error: error.message,
    });
  }
};

const createOutdoorSupply = async (req, res) => {
  try {
    const payload = normalizeOutdoorSupplyPayload(req.body);
    const validationMessage = validateOutdoorSupplyPayload(payload);

    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const supplier = await OutdoorSupplier.findById(payload.supplierId).lean();
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Outdoor supplier not found" });
    }

    const supply = await OutdoorSupply.create({
      ...payload,
      supplierName: payload.supplierName || supplier.supplierName,
      routeName: payload.routeName || supplier.routeName,
    });

    res.status(201).json({
      success: true,
      message: "Outdoor supply created successfully",
      data: supply,
    });
  } catch (error) {
    const statusCode = error?.code === 11000 ? 400 : 400;
    const message =
      error?.code === 11000
        ? "Outdoor supply invoice number already exists"
        : "Failed to create outdoor supply";

    res.status(statusCode).json({
      success: false,
      message,
      error: error.message,
    });
  }
};

const updateOutdoorSupply = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid outdoor supply ID" });
    }

    const existingSupply = await OutdoorSupply.findById(id);
    if (!existingSupply) {
      return res.status(404).json({ success: false, message: "Outdoor supply not found" });
    }

    const payload = normalizeOutdoorSupplyPayload(req.body, { partial: true });
    Object.assign(existingSupply, payload);

    const validationMessage = validateOutdoorSupplyPayload(existingSupply.toObject());
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage });
    }

    const supplier = await OutdoorSupplier.findById(existingSupply.supplierId).lean();
    if (!supplier) {
      return res.status(404).json({ success: false, message: "Outdoor supplier not found" });
    }

    if (!String(existingSupply.supplierName || "").trim()) {
      existingSupply.supplierName = supplier.supplierName;
    }

    if (!String(existingSupply.routeName || "").trim()) {
      existingSupply.routeName = supplier.routeName;
    }

    await existingSupply.save();

    res.status(200).json({
      success: true,
      message: "Outdoor supply updated successfully",
      data: existingSupply,
    });
  } catch (error) {
    const message =
      error?.code === 11000
        ? "Outdoor supply invoice number already exists"
        : "Failed to update outdoor supply";

    res.status(400).json({
      success: false,
      message,
      error: error.message,
    });
  }
};

const deleteOutdoorSupply = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid outdoor supply ID" });
    }

    const supply = await OutdoorSupply.findByIdAndDelete(id);

    if (!supply) {
      return res.status(404).json({ success: false, message: "Outdoor supply not found" });
    }

    res.status(200).json({
      success: true,
      message: "Outdoor supply deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to delete outdoor supply",
      error: error.message,
    });
  }
};

export {
  getOutdoorSuppliers,
  getOutdoorSupplierById,
  createOutdoorSupplier,
  updateOutdoorSupplier,
  deleteOutdoorSupplier,
  getOutdoorSupplies,
  getOutdoorSupplyById,
  createOutdoorSupply,
  updateOutdoorSupply,
  deleteOutdoorSupply,
};
