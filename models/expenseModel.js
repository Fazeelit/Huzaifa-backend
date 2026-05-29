import mongoose from "mongoose";

const ExpenseSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
    },
    category: {
      type: String,
      enum: [
        "Salary",
        "Rent",
        "Utilities",
        "Equipment",
        "Maintenance",
        "Marketing",
        "Supplies",
        "Transportation",
        "Professional Fees",
        "Insurance",
        "Taxes",
        "Other",
      ],
      default: "Other",
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    vendor: {
      type: String,
      trim: true,
      default: "",
    },
    paymentMethod: {
      type: String,
      enum: ["Cash", "Card", "Bank Transfer", "Cheque"],
      default: "Cash",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Completed", "Cancelled"],
      default: "Pending",
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    totalamount: {
      type: Number,
      default: 0,
    },
    investment:{
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

/**
 * Auto-assign amount to totalamount
 * when paymentStatus is Completed
 */
ExpenseSchema.pre("save", function (next) {
  if (this.paymentStatus === "Completed") {
    this.totalamount = this.amount;
  } else {
    this.totalamount = 0; // optional: reset if not completed
  }
  next();
});

const Expense = mongoose.model("Expense", ExpenseSchema);

export default Expense;
