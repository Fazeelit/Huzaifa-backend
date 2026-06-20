import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    date: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    amount: { type: String, trim: true, default: "" },
    paidAmount: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["paid", "pending", "overdue"],
      default: "pending",
    },
    dueDate: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const paymentHistorySchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    date: { type: String, trim: true, default: "" },
    amount: { type: String, trim: true, default: "" },
    method: { type: String, trim: true, default: "" },
    reference: { type: String, trim: true, default: "" },
    billId: { type: String, trim: true, default: "" },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const bankDetailsSchema = new mongoose.Schema(
  {
    bankName: { type: String, trim: true, default: "" },
    accountTitle: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    iban: { type: String, trim: true, default: "" },
    swiftCode: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const customerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fatherName: {
      type: String,
      trim: true,
      default: "",
    },
    cnic: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other", ""],
      default: "",
    },
    customerType: {
      type: String,
      enum: ["individual", "business", "corporate"],
      default: "individual",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "pending"],
      default: "active",
    },
    tags: {
      type: [String],
      default: [],
    },
    totalPurchases: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalSpent: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalDue: {
      type: Number,
      min: 0,
      default: 0,
    },
    satisfaction: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    lastPurchase: {
      type: String,
      trim: true,
      default: "",
    },
    companyName: {
      type: String,
      trim: true,
      default: "",
    },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    taxId: {
      type: String,
      trim: true,
      default: "",
    },
    registeredDate: {
      type: String,
      trim: true,
      default: "",
    },
    creditLimit: {
      type: Number,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    products: {
      type: [String],
      default: [],
    },
    bills: {
      type: [billSchema],
      default: [],
    },
    paymentHistory: {
      type: [paymentHistorySchema],
      default: [],
    },
    bankDetails: {
      type: bankDetailsSchema,
      default: () => ({}),
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

customerSchema.pre("save", function (next) {
  this.tags = Array.isArray(this.tags)
    ? [...new Set(this.tags.map((tag) => String(tag || "").trim()).filter(Boolean))]
    : [];
  next();
});

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);

export default Customer;
