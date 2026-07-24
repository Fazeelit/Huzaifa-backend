import mongoose from "mongoose";
import {
  ROLE_KEYS,
  normalizeRoleKey,
  normalizeUserStatus,
  USER_STATUSES,
} from "../constants/accessControl.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    role: {
      type: String,
      required: [true, "Role is required."],
      enum: ROLE_KEYS,
      set: normalizeRoleKey,
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "Active",
      set: normalizeUserStatus,
    },
    securitySettings: {
      requirePasswordChange: {
        type: Boolean,
        default: false,
      },
      twoFactorAuth: {
        type: Boolean,
        default: false,
      },
      ipRestrictions: {
        type: [String],
        default: [],
      },
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

userSchema.pre("validate", function (next) {
  this.role = normalizeRoleKey(this.role);
  this.status = normalizeUserStatus(this.status);
  next();
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
