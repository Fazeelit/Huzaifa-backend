import express from "express";
import {
  createTimetable,
  getAllTimetables,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
} from "../controllers/timetableController.js";

const router = express.Router();

router.post("/createTimetable", createTimetable);

router.get("/", getAllTimetables);
router.get("/timetables", getAllTimetables);

router.get("/:id", getTimetableById);
router.get("/timetables/:id", getTimetableById);

router.put("/:id", updateTimetable);
router.patch("/:id", updateTimetable);
router.put("/updateTimetable/:id", updateTimetable);

router.delete("/:id", deleteTimetable);
router.delete("/timetables/:id", deleteTimetable);

export default router;
