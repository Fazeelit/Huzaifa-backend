import express from "express";
import verifyToken, { authorizePermissions } from "../middleware/auth.js";
import {
  getAllExpenses,
  getExpenseById,
  createExpense,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController.js";

const router = express.Router();
router.use(verifyToken);

/* =======================
   EXPENSE ROUTES
======================= */

// Get all expenses (supports search & filter via query params)
router.get("/", authorizePermissions("EXPENSE_VIEW"), getAllExpenses);

// Get single expense by ID
router.get("/:id", authorizePermissions("EXPENSE_VIEW"), getExpenseById);

// Create new expense
router.post("/createExpense", authorizePermissions("EXPENSE_CREATE"), createExpense);

// Update expense
router.put("/updateExpense/:id", authorizePermissions("EXPENSE_EDIT"), updateExpense);

// Delete expense
router.delete("/deleteExpense/:id", authorizePermissions("EXPENSE_DELETE"), deleteExpense);

/* =======================
   EXPORT
======================= */

export default router;
