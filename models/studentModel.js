import mongoose from "mongoose";

const feeRecordSchema = new mongoose.Schema(
  {
    month: {
      type: String,
      trim: true,
    },
    year: {
      type: Number,
    },
    amount: {
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
  { _id: false }
);

const feeSchema = new mongoose.Schema(
  {
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
    mode: {
      type: String,
      enum: ["Monthly", "Annual"],
      default: "Monthly",
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    annualDiscount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const biometricSchema = new mongoose.Schema(
  {
    fingerprintEnrolled: {
      type: Boolean,
      default: false,
    },
    faceEnrolled: {
      type: Boolean,
      default: false,
    },
    fingerprintTemplate: {
      type: String,
      default: "",
    },
    faceTemplate: {
      type: String,
      default: "",
    },
  },
  { _id: false }
);

const studentSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: ["Male", "Female"],
      required: true,
      default: "Male",
    },
    dob: {
      type: Date,
      default: null,
    },
    cnicBForm: {
      type: String,
      trim: true,
      default: "",
    },
    phoneNumber: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    fatherName: {
      type: String,
      required: true,
      trim: true,
    },
    fatherCNIC: {
      type: String,
      trim: true,
      default: "",
    },
    fatherPhone: {
      type: String,
      trim: true,
      default: "",
    },
    motherName: {
      type: String,
      trim: true,
      default: "",
    },
    motherPhone: {
      type: String,
      trim: true,
      default: "",
    },
    whatsappNumber: {
      type: String,
      trim: true,
      default: "",
    },
    monthlyIncome: {
      type: Number,
      default: 0,
      min: 0,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    enrollmentClass: {
      type: String,
      required: true,
      trim: true,
    },
    previousClass: {
      type: String,
      trim: true,
      default: "",
    },
    previousSchool: {
      type: String,
      trim: true,
      default: "",
    },
    fee: {
      type: feeSchema,
      default: () => ({}),
    },
    biometric: {
      type: biometricSchema,
      default: () => ({}),
    },
    feeRecords: {
      type: [feeRecordSchema],
      default: [],
    },
    photo: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
);

const Student =
  mongoose.models.Student || mongoose.model("Student", studentSchema);

export default Student;
