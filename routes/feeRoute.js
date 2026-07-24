import express from "express";
import {
  createFee,
  getAllFees,
  getFeeById,
  updateFee,
  deleteFee,
} from "../controllers/feeController.js";

const router = express.Router();

router.post("/createFee", createFee);

router.get("/", getAllFees);
router.get("/fees", getAllFees);

router.get("/:id", getFeeById);
router.get("/fees/:id", getFeeById);

router.put("/:id", updateFee);
router.patch("/:id", updateFee);
router.put("/updateFee/:id", updateFee);

router.delete("/:id", deleteFee);
router.delete("/fees/:id", deleteFee);

export default router;
