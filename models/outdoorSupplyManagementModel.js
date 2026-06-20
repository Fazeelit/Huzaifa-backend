import mongoose from "mongoose";

const outdoorSupplierSchema = new mongoose.Schema(
  {
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNo: {
      type: String,
      required: true,
      trim: true,
    },
    gariNo: {
      type: String,
      required: true,
      trim: true,
    },
    routeName: {
      type: String,
      required: true,
      trim: true,
    },
    monthlyPay: {
      type: Number,
      required: true,
      min: 0,
    },
    commission: {
      type: Number,
      required: true,
      min: 0,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

const outdoorSupplyItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      trim: true,
      default: "",
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },
    receivedQuantity: {
      type: Number,
      required: true,
      min: 0,
    },
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    saleQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    _id: true,
  }
);

const outdoorSupplySchema = new mongoose.Schema(
  {
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "OutdoorSupplier",
      required: true,
    },
    supplierName: {
      type: String,
      required: true,
      trim: true,
    },
    routeName: {
      type: String,
      trim: true,
      default: "",
    },
    invoiceNumber: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    supplyDate: {
      type: Date,
      required: true,
    },
    items: {
      type: [outdoorSupplyItemSchema],
      default: [],
      validate: {
        validator(value) {
          return Array.isArray(value) && value.length > 0;
        },
        message: "At least one outdoor supply item is required",
      },
    },
    totalBill: {
      type: Number,
      required: true,
      min: 0,
    },
    createdSaleId: {
      type: String,
      trim: true,
      default: "",
    },
    createdSaleInvoiceNo: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

outdoorSupplySchema.pre("save", function (next) {
  const normalizedItems = Array.isArray(this.items) ? this.items : [];
  let computedTotalBill = 0;

  this.items = normalizedItems.map((item) => {
    const receivedQuantity = Math.max(Number(item.receivedQuantity || 0), 0);
    const returnedQuantity = Math.max(Number(item.returnedQuantity || 0), 0);
    const saleQuantity = Math.max(receivedQuantity - returnedQuantity, 0);
    const price = Math.max(Number(item.price || 0), 0);
    const totalPrice = Number((saleQuantity * price).toFixed(2));

    computedTotalBill += totalPrice;

    return {
      ...item.toObject?.(),
      productId: String(item.productId || "").trim(),
      productName: String(item.productName || "").trim(),
      manufacturer: String(item.manufacturer || "").trim(),
      receivedQuantity,
      returnedQuantity,
      saleQuantity,
      price,
      totalPrice,
    };
  });

  this.totalBill = Number(computedTotalBill.toFixed(2));
  next();
});

const OutdoorSupplier = mongoose.model("OutdoorSupplier", outdoorSupplierSchema);
const OutdoorSupply = mongoose.model("OutdoorSupply", outdoorSupplySchema);

export { OutdoorSupplier, OutdoorSupply };
