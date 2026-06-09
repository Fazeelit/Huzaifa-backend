import mongoose from "mongoose";

/* -------------------------------
  Purchase Schema
--------------------------------*/
const purchaseSchema = new mongoose.Schema(
  {
    supplier: {
      type: String,
      required: true,
      trim: true,
    },

    purchaseDate: {
      type: Date,
      required: true,
    },

    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    balance: {
      type: Number,
      min: 0,
    },

    taxAmount: {
      type: Number,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Partial", "Paid"],
      default: "Pending",
    },

    purchaseStatus: {
      type: String,
      enum: ["Draft", "Received", "Completed"],
      default: "Draft",
                 
    },

    /* -------------------------------
       Payment History
       Records all partial/full payments applied to this purchase
    --------------------------------*/
    paymentHistory: [
      {
        paymentId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "SupplierPayment",
          required: true, // must reference a valid SupplierPayment
        },
        appliedAmount: {
          type: Number,
          required: true,
          min: 1,
        },
        appliedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    /* -------------------------------
       Purchased Products
    --------------------------------*/
    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: { type: String, required: true },
        quantity: { type: Number, required: true },
        purchasePrice: { type: Number, required: true },
        manufacturer: { type: String, required: true },
        status: {
          type: String,
          enum: ["Claim", "Returned"],
        },
        statusQuantity: {
          type: Number,
          default: 0,
          min: 0,
        },
      },
    ],
  },
  { timestamps: true }
);

/* -------------------------------
   Pre-save hook
   Auto-calculate balance & payment status
--------------------------------*/
purchaseSchema.pre("save", function (next) {
  this.balance = Math.max(this.totalAmount - this.paidAmount, 0);

  if (this.paidAmount === 0) this.paymentStatus = "Pending";
  else if (this.paidAmount < this.totalAmount) this.paymentStatus = "Partial";
  else this.paymentStatus = "Paid";

  next();
});

const Purchase=mongoose.model("Purchase", purchaseSchema);

export default Purchase;
