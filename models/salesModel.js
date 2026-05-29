import mongoose from "mongoose";

/**
 * ✅ Calculate profit (handles returned items)
 */
const calculateSaleProfit = (sale = {}) => {
  const products = Array.isArray(sale?.products) ? sale.products : [];
  const totalPurchaseAmount = products.reduce((sum, product) => {
    const quantity = Number(product?.quantity) || 0;
    const returnedQty = Number(product?.returnedQuantity) || 0;
    const netQty = Math.max(0, quantity - returnedQty);
    const purchasePrice = Number(product?.purchasePrice) || 0;
    return sum + purchasePrice * netQty;
  }, 0);

  const totalAmount = Number(sale?.totalAmount) || 0;
  return Number((totalAmount - totalPurchaseAmount).toFixed(2));
};

const saleSchema = new mongoose.Schema(
  {
    invoiceNo: {
      type: String,
      trim: true,
      default: "",
    },

    customerName: {
      type: String,
      required: true,
      trim: true,
    },

    products: [
      {
        productId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
          required: true,
        },
        name: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 1 },
        returnedQuantity: { type: Number, default: 0, min: 0 },
        purchasePrice: { type: Number, required: true, min: 0 },
        salePrice: { type: Number, required: true, min: 0 },
      },
    ],

    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      min: 0,
      default: 0,
    },

    discount: {
      type: Number,
      min: 0,
      default: 0,
    },

    paidAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    returnAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    returnedAmount: {
      type: Number,
      min: 0,
      default: 0,
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Partial"],
      default: "Pending",
    },

    paymentMethod: {
      type: String,
      trim: true,
      default: "",
    },

    paymentHistory: [
      {
        amount: {
          type: Number,
          min: 0,
          default: 0,
        },
        method: {
          type: String,
          trim: true,
          default: "",
        },
        reference: {
          type: String,
          trim: true,
          default: "",
        },
        date: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    saleDate: {
      type: Date,
      default: Date.now,
    },

    notes: {
      type: String,
      trim: true,
    },

    profit: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

/**
 * ✅ On CREATE
 */
saleSchema.pre("save", function (next) {
  const customerName = String(this.customerName || "").trim().toLowerCase();
  const isWalkInCustomer =
    !customerName || customerName === "walk-in" || customerName === "walk in";

  // Auto mark paid only for walk-in sales when no paid amount is provided.
  if (this.isNew && isWalkInCustomer && (!this.paidAmount || this.paidAmount === 0)) {
    this.paidAmount = this.totalAmount;
    this.paymentStatus = "Paid";
  }

  // Calculate profit
  this.profit = calculateSaleProfit(this);

  next();
});

/**
 * ✅ On UPDATE (findOneAndUpdate / findByIdAndUpdate)
 */
saleSchema.pre("findOneAndUpdate", async function (next) {
  const update = this.getUpdate();

  const existingSale = await this.model
    .findOne(this.getQuery())
    .lean();

  const nextProducts =
    update?.products ??
    update?.$set?.products ??
    existingSale?.products ??
    [];
  const nextTotalAmount =
    update?.totalAmount ??
    update?.$set?.totalAmount ??
    existingSale?.totalAmount ??
    0;

  update.$set = {
    ...(update.$set || {}),
    profit: calculateSaleProfit({
      products: nextProducts,
      totalAmount: nextTotalAmount,
    }),
  };

  next();
});

const Sale = mongoose.model("Sale", saleSchema);

export default Sale;
