import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    date: { type: String, trim: true },
    description: { type: String, trim: true },
    amount: { type: String, trim: true },
    status: {
      type: String,
      enum: ["paid", "partial", "pending", "overdue"],
      default: "pending",
    },
    paidAmount: { type: String, default: "Rs. 0.00" },
    paidDate: { type: String, default: "" },
    paymentMethod: { type: String, default: "" },
    reference: { type: String, default: "" },
    dueDate: { type: String, default: "" },
  },
  { _id: false }
);

const paymentHistorySchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    date: { type: String, trim: true },
    amount: { type: String, trim: true },
    method: { type: String, trim: true },
    reference: { type: String, default: "" },
    billId: { type: String, default: "" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const statisticsSchema = new mongoose.Schema(
  {
    totalBills: { type: Number, default: 0 },
    paidBills: { type: Number, default: 0 },
    pendingBills: { type: Number, default: 0 },
    overdueBills: { type: Number, default: 0 },
    totalAmount: { type: String, default: "Rs. 0.00" },
    paidAmount: { type: String, default: "Rs. 0.00" },
    pendingAmount: { type: String, default: "Rs. 0.00" },
    overdueAmount: { type: String, default: "Rs. 0.00" },
    lastPaymentDate: { type: String, default: "" },
    nextPaymentDue: { type: String, default: "" },
    averagePaymentDays: { type: Number, default: 0 },
  },
  { _id: false }
);

const SupplierSchema = new mongoose.Schema(
  {
    supplierId: {
      type: String,
      unique: true,
      required: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    contactPerson: {
      type: String,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
      match: [/^03\d{2}-\d{7}$/, "Phone must be in format 0300-1234567"],
    },

    mobile: {
      type: String,
      trim: true,
      default: "",
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    address: {
      type: String,
      required: true,
      trim: true,
    },

    companyName: {
      type: String,
      trim: true,
    },

    openingBalance: {
      type: Number,
      default: 0,
    },

    productsSupplied: [
      {
        type: String, // or ObjectId if linked to Product model
      },
    ],

    paymentTerms: {
      type: String, // e.g. "Cash", "15 Days", "30 Days"
      default: "Cash",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "active", "pending", "inactive"],
      default: "Active",
    },

    preferred: {
      type: Boolean,
      default: false,
    },

    notes: {
      type: String,
    },
    totalDue: {
      type: Number,
      min: 0,
      default: 0,
    },
    lastPurchase: {
      type: String,
      trim: true,
      default: "",
    },
    bills: { type: [billSchema], default: [] },
    paymentHistory: { type: [paymentHistorySchema], default: [] },
    statistics: { type: statisticsSchema, default: () => ({}) },
  },
  {
    timestamps: true, // createdAt & updatedAt
  }
);

 
 const Supplier= mongoose.model("Supplier", SupplierSchema);

export default Supplier;
