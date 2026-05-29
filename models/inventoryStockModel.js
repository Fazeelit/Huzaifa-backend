import mongoose from "mongoose";

const inventoryStockItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    batchNo: { type: String, trim: true },
    expiryDate: { type: String, trim: true },
    purchaseQty: { type: Number, required: true, min: 0 },
    purchasePrice: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, required: true, min: 0 },
    uom: { type: String, trim: true },
    baseUnit: { type: String, trim: true },
    stockQtyBase: { type: Number, required: true, min: 0 },
    beforeStock: { type: Number, required: true, min: 0 },
    afterStock: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const inventoryStockSchema = new mongoose.Schema(
  {
    billNo: { type: String, required: true, trim: true, index: true },
    items: { type: [inventoryStockItemSchema], default: [] },
    totalItems: { type: Number, default: 0 },
    totalBaseUnitsAdded: { type: Number, default: 0 },
    stockedAt: { type: Date, default: Date.now },
    stockedBy: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

const InventoryStock = mongoose.model("InventoryStock", inventoryStockSchema);

export default InventoryStock;

