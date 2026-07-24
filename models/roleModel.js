import mongoose from "mongoose";
import {
  ROLE_KEYS,
  SCHOOL_PERMISSION_KEYS,
  sanitizePermissions,
} from "../constants/accessControl.js";

const RoleSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      enum: ROLE_KEYS,
      unique: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    permissions: {
      type: [String],
      enum: SCHOOL_PERMISSION_KEYS,
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && new Set(value).size === value.length,
        message: "Duplicate permissions are not allowed",
      },
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

RoleSchema.pre("validate", function (next) {
  this.role = String(this.role || "").trim().toUpperCase();
  this.permissions = sanitizePermissions(this.permissions);
  next();
});

const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);

export default Role;
