import mongoose from "mongoose";

/* -------------------------------
  Supplier Payment Schema
--------------------------------*/
const supplierPaymentSchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
      trim: true,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 1,
    },
    appliedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const SupplierPayment = mongoose.model("SupplierPayment", supplierPaymentSchema);

export default SupplierPayment;
