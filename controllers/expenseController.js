import mongoose from "mongoose";
import Expense from "../models/expenseModel.js";


// Get all expenses
const getAllExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find().sort({ date: -1 }); // Latest first
    res.status(200).json({ success: true, data: expenses });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res.status(500).json({ success: false, message: "Failed to fetch expenses" });
  }
};

// Get single expense by ID
const getExpenseById = async (req, res) => {
  try {
    const { id } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }

    const expense = await Expense.findById(id);
    if (!expense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    res.status(200).json({ success: true, data: expense });
  } catch (error) {
    console.error("Error fetching expense:", error);
    res.status(500).json({ success: false, message: "Failed to fetch expense" });
  }
};

// Create new expense


const createExpense = async (req, res) => {
  try {
    const {
      date,
      category,
      description,
      vendor,
      paymentMethod,
      paymentStatus,
      amount,
      status,
      referenceNumber,
      investment,
      notes,
    } = req.body;

    // Required validation
    if (!date || !description || !amount) {
      return res.status(400).json({
        success: false,
        message: "Date, description and amount are required",
      });
    }

    const expense = new Expense({
      date,
      category,
      description,
      vendor,
      paymentMethod,
      paymentStatus,
      amount: Number(amount),
      status,
      referenceNumber,
      investment,
      notes,
    });

    const savedExpense = await expense.save();

    res.status(201).json({
      success: true,
      message: "Expense created successfully",
      data: savedExpense,
    });
  } catch (error) {
    console.error("Create Expense Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create expense",
    });
  }
};

const updateExpense = async (req, res) => {
  try {
    const { id } = req.params; // <- change from req.query
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }

    const updatedExpense = await Expense.findByIdAndUpdate(
      id,
      { ...updateData, amount: updateData.amount ? Number(updateData.amount) : undefined },
      { new: true, runValidators: true }
    );

    if (!updatedExpense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    res.status(200).json({ success: true, data: updatedExpense });
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(500).json({ success: false, message: "Failed to update expense" });
  }
};

// Delete expense
const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid expense ID" });
    }

    const deletedExpense = await Expense.findByIdAndDelete(id);
    if (!deletedExpense) {
      return res.status(404).json({ success: false, message: "Expense not found" });
    }

    res.status(200).json({ success: true, message: "Expense deleted successfully" });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ success: false, message: "Failed to delete expense" });
  }
};

// Export all controllers at the end
export {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
};
