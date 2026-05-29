// models/Role.js
import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema(
  {
    // Role key used in login & auth (ADMIN, PHARMACY, etc.)
    role: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,          // 🔥 prevent duplicate roles
      index: true,
    },

    description: {
      type: String,
      trim: true,
      default: "",
    },

    // Flat permissions list (used by PermissionsModal & Login)
    permissions: {
      type: [String],
      enum: [
        "DASHBOARD_VIEW",

        "POS_VIEW",
        "POS_CREATE",
        "POS_EDIT",
        "POS_DELETE",

        "CUSTOMER_VIEW",
        "CUSTOMER_CREATE",
        "CUSTOMER_EDIT",
        "CUSTOMER_DELETE",

        "PRODUCT_VIEW",
        "PRODUCT_CREATE",
        "PRODUCT_EDIT",
        "PRODUCT_DELETE",

        "PURCHASE_VIEW",
        "PURCHASE_CREATE",
        "PURCHASE_EDIT",
        "PURCHASE_DELETE",
        "PARTIAL_PAYMENT_ADD",

        "SUPPLIER_VIEW",
        "SUPPLIER_CREATE",
        "SUPPLIER_EDIT",
        "SUPPLIER_DELETE",

        "SALE_VIEW",
        "SALE_CREATE",
        "SALE_EDIT",
        "SALE_DELETE",

        "EXPENSE_VIEW",
        "EXPENSE_CREATE",
        "EXPENSE_EDIT",
        "EXPENSE_DELETE",

        "REPORT_VIEW",

        "USER_VIEW",
        "USER_CREATE",
        "USER_EDIT",
        "USER_DELETE",

        "ROLE_VIEW",
        "ROLE_CREATE",
        "ROLE_EDIT",
        "ROLE_DELETE",

        "ACTIVITY_VIEW",
      ],
      default: [],
      validate: {
        validator: (v) => Array.isArray(v) && new Set(v).size === v.length,
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

// 🔥 Auto-sanitize permissions before save
RoleSchema.pre("save", function (next) {
  if (this.permissions?.length) {
    this.permissions = [...new Set(this.permissions)];
  }
  next();
});

const Role = mongoose.models.Role || mongoose.model("Role", RoleSchema);
export default Role;
