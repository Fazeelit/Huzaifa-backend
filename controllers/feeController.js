import mongoose from "mongoose";
import Fee from "../models/feeModel.js";

const buildPayload = (body = {}) => ({
  studentId: body.studentId?.toString().trim() || "",
  month: body.month?.trim() || "",
  year: Number(body.year) || 0,
  registrationFee: Number(body.registrationFee) || 0,
  monthlyFee: Number(body.monthlyFee) || 0,
  status: body.status?.trim() || "Pending",
  paidDate: body.paidDate || null,
});

const createFee = async (req, res) => {
  try {
    const payload = buildPayload(req.body);

    if (!payload.month || !payload.year) {
      return res.status(400).json({
        success: false,
        message: "Month and year are required",
      });
    }

    const feeItem = await Fee.create(payload);

    return res.status(201).json({
      success: true,
      message: "Fee created successfully",
      feeItem,
    });
  } catch (error) {
    console.error("Create Fee Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create fee",
    });
  }
};

const getAllFees = async (req, res) => {
  try {
    const { studentId, month, year, status, search } = req.query;
    const query = {};

    if (studentId) {
      query.studentId = studentId;
    }

    if (month) {
      query.month = month;
    }

    if (year) {
      query.year = Number(year);
    }

    if (status) {
      query.status = status;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ month: regex }, { studentId: regex }, { status: regex }];
    }

    const fees = await Fee.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      total: fees.length,
      fees,
    });
  } catch (error) {
    console.error("Get Fees Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch fees",
    });
  }
};

const getFeeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fee id",
      });
    }

    const feeItem = await Fee.findById(id);

    if (!feeItem) {
      return res.status(404).json({
        success: false,
        message: "Fee not found",
      });
    }

    return res.status(200).json({
      success: true,
      feeItem,
    });
  } catch (error) {
    console.error("Get Fee Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch fee",
    });
  }
};

const updateFee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fee id",
      });
    }

    const payload = buildPayload(req.body);
    const feeItem = await Fee.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!feeItem) {
      return res.status(404).json({
        success: false,
        message: "Fee not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Fee updated successfully",
      feeItem,
    });
  } catch (error) {
    console.error("Update Fee Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update fee",
    });
  }
};

const deleteFee = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid fee id",
      });
    }

    const feeItem = await Fee.findByIdAndDelete(id);

    if (!feeItem) {
      return res.status(404).json({
        success: false,
        message: "Fee not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Fee deleted successfully",
    });
  } catch (error) {
    console.error("Delete Fee Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete fee",
    });
  }
};

export {
  createFee,
  getAllFees,
  getFeeById,
  updateFee,
  deleteFee,
};
