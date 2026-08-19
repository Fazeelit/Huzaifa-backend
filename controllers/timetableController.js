import mongoose from "mongoose";
import Timetable from "../models/timetableModel.js";

const TIMETABLE_SCOPES = new Set(["general", "class", "teacher"]);

const normalizeScope = (value, body = {}) => {
  const requestedScope = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (TIMETABLE_SCOPES.has(requestedScope)) {
    return requestedScope;
  }

  if (body.teacher?.trim() && !body.className?.trim() && !body.section?.trim()) {
    return "teacher";
  }

  if (!body.className?.trim() && !body.section?.trim() && !body.teacher?.trim() && !body.subject?.trim()) {
    return "general";
  }

  return "class";
};

const buildPayload = (body = {}) => ({
  scope: normalizeScope(body.scope, body),
  period: body.period?.trim() || "",
  time: body.time?.trim() || "",
  subject: body.subject?.trim() || "",
  teacher: body.teacher?.trim() || "",
  className: body.className?.trim() || "",
  section: body.section?.trim() || "",
  day: body.day?.trim() || "",
});

const validatePayload = (payload) => {
  if (!payload.period || !payload.time) {
    return "Period and time are required";
  }

  if (payload.scope === "general") {
    payload.subject = "";
    payload.teacher = "";
    payload.className = "";
    payload.section = "";
    payload.day = payload.day || "";
    return null;
  }

  if (payload.scope === "teacher") {
    if (!payload.teacher) {
      return "Teacher name is required for teacher timetable entries";
    }

    payload.className = payload.className || "";
    payload.section = payload.section || "";
    return null;
  }

  if (!payload.className) {
    return "Class name is required for class timetable entries";
  }

  return null;
};

const createTimetable = async (req, res) => {
  try {
    const payload = buildPayload(req.body);
    const validationError = validatePayload(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const timetableItem = await Timetable.create(payload);

    return res.status(201).json({
      success: true,
      message: "Timetable created successfully",
      timetableItem,
    });
  } catch (error) {
    console.error("Create Timetable Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create timetable",
    });
  }
};

const getAllTimetables = async (req, res) => {
  try {
    const { className, section, day, teacher, search, scope } = req.query;
    const query = {};

    const normalizedScope = normalizeScope(scope);
    if (TIMETABLE_SCOPES.has(normalizedScope) && scope) {
      query.scope = normalizedScope;
    }

    if (className) {
      query.className = className;
    }

    if (section) {
      query.section = section;
    }

    if (day) {
      query.day = day;
    }

    if (teacher) {
      query.teacher = teacher;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { period: regex },
        { time: regex },
        { subject: regex },
        { teacher: regex },
        { className: regex },
        { section: regex },
      ];
    }

    const timetables = await Timetable.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      total: timetables.length,
      timetables,
    });
  } catch (error) {
    console.error("Get Timetables Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch timetables",
    });
  }
};

const getTimetableById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid timetable id",
      });
    }

    const timetableItem = await Timetable.findById(id);

    if (!timetableItem) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found",
      });
    }

    return res.status(200).json({
      success: true,
      timetableItem,
    });
  } catch (error) {
    console.error("Get Timetable Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch timetable",
    });
  }
};

const updateTimetable = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid timetable id",
      });
    }

    const payload = buildPayload(req.body);
    const validationError = validatePayload(payload);

    if (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError,
      });
    }

    const timetableItem = await Timetable.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!timetableItem) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Timetable updated successfully",
      timetableItem,
    });
  } catch (error) {
    console.error("Update Timetable Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update timetable",
    });
  }
};

const deleteTimetable = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid timetable id",
      });
    }

    const timetableItem = await Timetable.findByIdAndDelete(id);

    if (!timetableItem) {
      return res.status(404).json({
        success: false,
        message: "Timetable not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Timetable deleted successfully",
    });
  } catch (error) {
    console.error("Delete Timetable Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete timetable",
    });
  }
};

export {
  createTimetable,
  getAllTimetables,
  getTimetableById,
  updateTimetable,
  deleteTimetable,
};
