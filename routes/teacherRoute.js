import express from "express";
import {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
} from "../controllers/teacherController.js";

const router = express.Router();

router.post("/createTeacher", createTeacher);

router.get("/", getAllTeachers);
router.get("/teachers", getAllTeachers);

router.get("/:id", getTeacherById);
router.get("/teachers/:id", getTeacherById);

router.put("/:id", updateTeacher);
router.patch("/:id", updateTeacher);
router.put("/updateTeacher/:id", updateTeacher);
router.delete("/deleteteachers/:id", deleteTeacher);

export default router;
