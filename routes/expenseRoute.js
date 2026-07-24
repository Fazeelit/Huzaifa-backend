import express from "express";
import {
  createExpense,
  getAllExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
} from "../controllers/expenseController.js";

const router = express.Router();

router.post("/createExpense", createExpense);

router.get("/", getAllExpenses);
router.get("/expenses", getAllExpenses);

router.get("/:id", getExpenseById);
router.get("/expenses/:id", getExpenseById);

router.put("/:id", updateExpense);
router.patch("/:id", updateExpense);
router.put("/updateExpense/:id", updateExpense);

router.delete("/:id", deleteExpense);
router.delete("/expenses/:id", deleteExpense);

export default router;
