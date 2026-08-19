import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    personName: {
      type: String,
      required: true,
      trim: true,
    },
    personType: {
      type: String,
      enum: ["student", "teacher"],
      default: "student",
    },
    personId: {
      type: String,
      trim: true,
      default: "",
    },
    registrationId: {
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
    status: {
      type: String,
      enum: ["Present", "Absent", "Unmarked"],
      default: "Unmarked",
    },
    time: {
      type: String,
      trim: true,
      default: "",
    },
    date: {
      type: Date,
      default: Date.now,
    },
    attendanceDateKey: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

attendanceSchema.index(
  { personType: 1, personId: 1, attendanceDateKey: 1 },
  {
    unique: true,
    // MongoDB partial indexes do not support $ne (it is rewritten as $not).
    // Every valid person id is a non-empty string, so $gt excludes empty ids.
    partialFilterExpression: { personId: { $type: "string", $gt: "" } },
  }
);
attendanceSchema.index({ attendanceDateKey: 1, personType: 1, className: 1, section: 1, date: -1 });
attendanceSchema.index({ registrationId: 1, date: -1 });
attendanceSchema.index({ date: -1, createdAt: -1 });

const Attendance =
  mongoose.models.Attendance || mongoose.model("Attendance", attendanceSchema);

export default Attendance;
