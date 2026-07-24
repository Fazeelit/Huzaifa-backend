import mongoose from "mongoose";

const feeSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      trim: true,
      default: "",
    },
    month: {
      type: String,
      required: true,
      trim: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    registrationFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    monthlyFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["Pending", "Paid", "Unpaid"],
      default: "Pending",
    },
    paidDate: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

const Fee = mongoose.models.Fee || mongoose.model("Fee", feeSchema);

export default Fee;
