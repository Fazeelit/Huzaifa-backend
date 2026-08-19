import mongoose from "mongoose";
import Attendance from "../models/attendanceModel.js";

const toDateKey = (value) => {
  const rawDate = value ? new Date(value) : new Date();
  if (Number.isNaN(rawDate.getTime())) {
    return new Date().toISOString().split("T")[0];
  }
  return rawDate.toISOString().split("T")[0];
};

const buildPayload = (body = {}) => ({
  personName: body.personName?.trim() || "",
  personType: body.personType?.trim() || "student",
  personId: body.personId?.toString().trim() || "",
  registrationId: body.registrationId?.toString().trim() || "",
  className: body.className?.trim() || "",
  section: body.section?.trim() || "",
  status: body.status?.trim() || "Unmarked",
  time: body.time?.trim() || "",
  date: body.date ? new Date(body.date) : new Date(),
  attendanceDateKey: toDateKey(body.date),
});

const createAttendance = async (req, res) => {
  try {
    const payload = buildPayload(req.body);

    if (!payload.personName) {
      return res.status(400).json({
        success: false,
        message: "Person name is required",
      });
    }

    if (!payload.personId) {
      return res.status(400).json({
        success: false,
        message: "Person id is required",
      });
    }

    const attendanceItem = await Attendance.findOneAndUpdate(
      {
        personType: payload.personType,
        personId: payload.personId,
        attendanceDateKey: payload.attendanceDateKey,
      },
      payload,
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(201).json({
      success: true,
      message: "Attendance saved successfully",
      attendanceItem,
    });
  } catch (error) {
    console.error("Create Attendance Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create attendance",
    });
  }
};

const getAllAttendance = async (req, res) => {
  try {
    const { personType, status, personId, registrationId, search, date, className, section } = req.query;
    const query = {};

    if (personType) {
      query.personType = personType;
    }

    if (status) {
      query.status = status;
    }

    if (personId) {
      query.personId = personId;
    }

    if (registrationId) {
      query.registrationId = registrationId;
    }

    if (date) {
      query.attendanceDateKey = toDateKey(date);
    }

    if (className) {
      query.className = className;
    }

    if (section) {
      query.section = section;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { personName: regex },
        { personId: regex },
        { registrationId: regex },
        { className: regex },
        { section: regex },
        { status: regex },
      ];
    }

    const attendance = await Attendance.find(query).sort({ date: -1, createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      total: attendance.length,
      attendance,
    });
  } catch (error) {
    console.error("Get Attendance Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch attendance",
    });
  }
};

const getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance id",
      });
    }

    const attendanceItem = await Attendance.findById(id);

    if (!attendanceItem) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    return res.status(200).json({
      success: true,
      attendanceItem,
    });
  } catch (error) {
    console.error("Get Attendance Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch attendance",
    });
  }
};

const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance id",
      });
    }

    const payload = buildPayload(req.body);
    const attendanceItem = await Attendance.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!attendanceItem) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance updated successfully",
      attendanceItem,
    });
  } catch (error) {
    console.error("Update Attendance Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update attendance",
    });
  }
};

const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid attendance id",
      });
    }

    const attendanceItem = await Attendance.findByIdAndDelete(id);

    if (!attendanceItem) {
      return res.status(404).json({
        success: false,
        message: "Attendance not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Attendance deleted successfully",
    });
  } catch (error) {
    console.error("Delete Attendance Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete attendance",
    });
  }
};

export {
  createAttendance,
  getAllAttendance,
  getAttendanceById,
  updateAttendance,
  deleteAttendance,
};
