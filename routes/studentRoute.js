import express from "express";
import {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
} from "../controllers/studentController.js";

const router = express.Router();

router.post("/createStudent", createStudent);

router.get("/", getAllStudents);
router.get("/students", getAllStudents);

router.get("/:id", getStudentById);
router.get("/students/:id", getStudentById);

router.put("/:id", updateStudent);
router.patch("/:id", updateStudent);
router.put("/updateStudent/:id", updateStudent);

router.delete("/:id", deleteStudent);
router.delete("/students/:id", deleteStudent);

export default router;
