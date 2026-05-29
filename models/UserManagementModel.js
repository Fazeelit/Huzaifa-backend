import mongoose from "mongoose";

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
      match: [/^03\d{2}-\d{7}$/, "Phone must be in format 0300-1234567"],
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    role: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "USER",
    },
    department: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Suspended"],
      default: "Active",
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
        type: [String], // Array of IP strings
        default: [],
      },
    },
    lastLogin: {
      type: Date, // store last login date
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Optional: auto-update updatedAt field on save
userSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
