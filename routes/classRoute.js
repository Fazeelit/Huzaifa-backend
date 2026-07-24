import express from "express";
import {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  getClassWithStudents,
  getClassTeacherOptions,
} from "../controllers/classController.js";

const router = express.Router();

router.post("/createClass", createClass);

router.get("/", getAllClasses);
router.get("/classes", getAllClasses);
router.get("/teacher-options", getClassTeacherOptions);
router.get("/class-detail/:className/:section", getClassWithStudents);

router.get("/:id", getClassById);
router.get("/classes/:id", getClassById);

router.put("/:id", updateClass);
router.patch("/:id", updateClass);
router.put("/updateClass/:id", updateClass);

router.delete("/:id", deleteClass);
router.delete("/classes/:id", deleteClass);

export default router;
