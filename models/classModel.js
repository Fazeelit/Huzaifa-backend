import mongoose from "mongoose";

const classSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    incharge: {
      type: String,
      trim: true,
      default: "",
    },
    academicYear: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

classSchema.index({ name: 1, section: 1 }, { unique: true });
classSchema.index({ createdAt: -1 });

const ClassModel =
  mongoose.models.Class || mongoose.model("Class", classSchema);

export default ClassModel;
