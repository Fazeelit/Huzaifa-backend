import mongoose from "mongoose";
import { getStockToBaseFactor } from "../util/uomConverter.js";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true      
    },

    packSize: {
      type: String,
      required: true,
      trim: true,
    },

    shelf: {
      type: Number,     
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    category: {
      type: String,
      required: true,
      trim: true,
    },

    purchasePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    retailSalePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    wholeSalePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    salePrice: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    actualStock: {
      type: Number,
      min: 0,
      default: 0,
    },

    manufacturer: {
      type: String,
      required: true,
      trim: true,
    },

    unit: {
      type: String,
      required: true,
    },
    baseUnit: {
      type: String,
      trim: true,
      default: "",
    },
    uomLevels: {
      type: [
        {
          unit: { type: String, required: true, trim: true },
          contains: { type: Number, required: true, min: 1 },
          child: { type: String, required: true, trim: true },
        },
      ],
      default: [],
    },
    discountAllowed: {
      type: Boolean,
      default: false,
    },
    maxAllowedDiscount: {
      type: Number,
      min: 0,
      default: 0,
    },
    date: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },

    description: {
      type: String,
      trim: true,
    },

    lowStock: {
      type: Boolean,
      default: false,
    },
    profit: {
      type: Number,
    }
  },
  {
    timestamps: true,
  }
);

/**
 * Auto-calculate lowStock on CREATE
 */
productSchema.pre("save", function (next) {
  if (this.retailSalePrice === undefined || this.retailSalePrice === null) {
    this.retailSalePrice = Number(this.salePrice || 0);
  }
  this.salePrice = Number(this.retailSalePrice || 0);

  if (!this.baseUnit || !String(this.baseUnit).trim()) {
    this.baseUnit = String(this.unit || "").trim().toLowerCase();
  } else {
    this.baseUnit = String(this.baseUnit).trim().toLowerCase();
  }

  this.actualStock = Number(((Number(this.stock) || 0) * getStockToBaseFactor(this)).toFixed(4));
  this.lowStock = this.stock <= 10;

  next();
});

/**
 * Auto-calculate lowStock/actualStock on UPDATE
 */
productSchema.pre("findOneAndUpdate", async function (next) {
  try {
    const update = this.getUpdate();
    const rootUpdate = update?.$set ? update.$set : update;
    if (!rootUpdate) return next();

    if (rootUpdate.retailSalePrice === undefined && rootUpdate.salePrice !== undefined) {
      rootUpdate.retailSalePrice = rootUpdate.salePrice;
    }
    if (rootUpdate.retailSalePrice !== undefined) {
      rootUpdate.salePrice = rootUpdate.retailSalePrice;
    }

    const hasStock = rootUpdate.stock !== undefined;

    if (rootUpdate.baseUnit !== undefined) {
      rootUpdate.baseUnit = String(rootUpdate.baseUnit || "").trim().toLowerCase();
    }

    if (hasStock) {
      const existingDoc = await this.model
        .findOne(this.getQuery())
        .select("stock packSize unit baseUnit uomLevels")
        .lean();

      const nextStock = Number(
        hasStock ? rootUpdate.stock : existingDoc?.stock ?? 0
      ) || 0;
      const factorSource = {
        ...(existingDoc || {}),
        ...rootUpdate,
      };
      rootUpdate.actualStock = Number((nextStock * getStockToBaseFactor(factorSource)).toFixed(4));
      rootUpdate.lowStock = nextStock <= 10;
    }

    if (update?.$set) {
      update.$set = rootUpdate;
      this.setUpdate(update);
    } else {
      this.setUpdate(rootUpdate);
    }

    next();
  } catch (error) {
    next(error);
  }
});

const Product = mongoose.model("Product", productSchema);

export default Product;
