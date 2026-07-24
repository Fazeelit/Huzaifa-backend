import express from "express";
import {
  createResult,
  getAllResults,
  getResultById,
  getResultByStudent,
  updateResult,
  upsertResult,
  deleteResult,
} from "../controllers/resultController.js";

const router = express.Router();

router.post("/createResult", createResult);
router.post("/upsert", upsertResult);

router.get("/", getAllResults);
router.get("/student/:studentId", getResultByStudent);

router.get("/:id", getResultById);

router.put("/:id", updateResult);
router.patch("/:id", updateResult);
router.put("/updateResult/:id", updateResult);

router.delete("/:id", deleteResult);
router.delete("/results/:id", deleteResult);

export default router;
