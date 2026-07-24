import mongoose from "mongoose";
import Expense from "../models/expenseModel.js";

const buildPayload = (body = {}) => ({
  category: body.category?.trim() || "",
  amount: Number(body.amount) || 0,
  date: body.date || null,
});

const createExpense = async (req, res) => {
  try {
    const payload = buildPayload(req.body);

    if (!payload.category || !payload.date || payload.amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Category, valid amount, and date are required",
      });
    }

    const expenseItem = await Expense.create(payload);

    return res.status(201).json({
      success: true,
      message: "Expense created successfully",
      expenseItem,
    });
  } catch (error) {
    console.error("Create Expense Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create expense",
    });
  }
};

const getAllExpenses = async (req, res) => {
  try {
    const { category, search } = req.query;
    const query = {};

    if (category) {
      query.category = category;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ category: regex }];
    }

    const expenses = await Expense.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: expenses.length,
      expenses,
    });
  } catch (error) {
    console.error("Get Expenses Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch expenses",
    });
  }
};

const getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense id",
      });
    }

    const expenseItem = await Expense.findById(id);

    if (!expenseItem) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.status(200).json({
      success: true,
      expenseItem,
    });
  } catch (error) {
    console.error("Get Expense Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch expense",
    });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense id",
      });
    }

    const payload = buildPayload(req.body);
    const expenseItem = await Expense.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!expenseItem) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      expenseItem,
    });
  } catch (error) {
    console.error("Update Expense Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update expense",
    });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid expense id",
      });
    }

    const expenseItem = await Expense.findByIdAndDelete(id);

    if (!expenseItem) {
      return res.status(404).json({
        success: false,
        message: "Expense not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Expense deleted successfully",
    });
  } catch (error) {
    console.error("Delete Expense Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete expense",
    });
  }
};

export {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};
