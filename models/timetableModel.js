import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema(
  {
    scope: {
      type: String,
      trim: true,
      enum: ["general", "class", "teacher"],
      default: "class",
    },
    period: {
      type: String,
      required: true,
      trim: true,
    },
    time: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: "",
    },
    teacher: {
      type: String,
      trim: true,
      default: "",
    },
    className: {
      type: String,
      trim: true,
      default: "",
    },
    section: {
      type: String,
      trim: true,
      default: "",
    },
    day: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

const Timetable =
  mongoose.models.Timetable || mongoose.model("Timetable", timetableSchema);

export default Timetable;
