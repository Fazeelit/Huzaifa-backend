import express from "express";
import {
  createAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
} from "../controllers/attendanceController.js";

const router = express.Router();

router.post("/createAttendance", createAttendance);

router.get("/", getAllAttendance);

router.get("/:id", getAttendanceById);

router.put("/:id", updateAttendance);
router.patch("/:id", updateAttendance);
router.put("/updateAttendance/:id", updateAttendance);

router.delete("/deleteAttendance/:id", deleteAttendance);

export default router;
