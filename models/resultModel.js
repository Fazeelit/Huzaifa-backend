import mongoose from "mongoose";

const subjectMarkSchema = new mongoose.Schema(
  {
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    totalMarks: {
      type: Number,
      default: 100,
      min: 0,
    },
    obtainedMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

const termResultSchema = new mongoose.Schema(
  {
    termName: {
      type: String,
      enum: ["1st Term", "2nd Term", "Final Term"],
      required: true,
      trim: true,
    },
    totalMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    obtainedMarks: {
      type: Number,
      default: 0,
      min: 0,
    },
    percentage: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["PASS", "FAIL"],
      default: "FAIL",
    },
    subjectMarks: {
      type: [subjectMarkSchema],
      default: [],
    },
    teacherRemarks: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { _id: false }
);

const resultSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    registrationNumber: {
      type: String,
      required: true,
      trim: true,
    },
    className: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    fatherName: {
      type: String,
      trim: true,
      default: "",
    },
    terms: {
      type: [termResultSchema],
      default: [],
    },
  },
  { timestamps: true }
);

resultSchema.index({ studentId: 1, createdAt: -1 });
resultSchema.index({ registrationNumber: 1, createdAt: -1 });
resultSchema.index({ className: 1, section: 1, createdAt: -1 });
resultSchema.index({ createdAt: -1 });

const Result =
  mongoose.models.Result || mongoose.model("Result", resultSchema);

export default Result;
