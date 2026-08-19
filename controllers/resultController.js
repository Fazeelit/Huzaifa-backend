import mongoose from "mongoose";
import Result from "../models/resultModel.js";

const normalizeTerm = (term = {}) => {
  const subjectMarks = Array.isArray(term.subjectMarks) ? term.subjectMarks : [];
  const totalMarks =
    term.totalMarks ??
    subjectMarks.reduce((sum, item) => sum + (Number(item.totalMarks) || 0), 0);
  const obtainedMarks =
    term.obtainedMarks ??
    subjectMarks.reduce((sum, item) => sum + (Number(item.obtainedMarks) || 0), 0);
  const percentage =
    totalMarks > 0 ? Number(((obtainedMarks / totalMarks) * 100).toFixed(2)) : 0;

  return {
    termName: term.termName,
    totalMarks,
    obtainedMarks,
    percentage,
    status: percentage >= 40 ? "PASS" : "FAIL",
    subjectMarks: subjectMarks.map((item) => ({
      subjectName: item.subjectName?.trim() || "",
      totalMarks: Number(item.totalMarks) || 0,
      obtainedMarks: Number(item.obtainedMarks) || 0,
    })),
    teacherRemarks: term.teacherRemarks?.trim() || "",
  };
};

const buildPayload = (body = {}) => ({
  studentId: body.studentId?.toString().trim() || "",
  studentName: body.studentName?.trim() || "",
  registrationNumber: body.registrationNumber?.trim() || "",
  className: body.className?.trim() || "",
  section: body.section?.trim() || "",
  fatherName: body.fatherName?.trim() || "",
  terms: Array.isArray(body.terms) ? body.terms.map(normalizeTerm) : [],
});

const createResult = async (req, res) => {
  try {
    const payload = buildPayload(req.body);

    if (
      !payload.studentId ||
      !payload.studentName ||
      !payload.registrationNumber ||
      !payload.className ||
      !payload.section
    ) {
      return res.status(400).json({
        success: false,
        message: "Student id, student name, registration number, class and section are required",
      });
    }

    const existingResult = await Result.findOne({
      studentId: payload.studentId,
      registrationNumber: payload.registrationNumber,
    });

    if (existingResult) {
      return res.status(409).json({
        success: false,
        message: "Result already exists for this student",
      });
    }

    const resultItem = await Result.create(payload);

    return res.status(201).json({
      success: true,
      message: "Result created successfully",
      resultItem,
    });
  } catch (error) {
    console.error("Create Result Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create result",
    });
  }
};

const getAllResults = async (req, res) => {
  try {
    const { search, className, section, registrationNumber } = req.query;
    const query = {};

    if (className) {
      query.className = className;
    }

    if (section) {
      query.section = section;
    }

    if (registrationNumber) {
      query.registrationNumber = registrationNumber;
    } else if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { studentName: regex },
        { studentId: regex },
        { registrationNumber: regex },
        { className: regex },
        { section: regex },
        { fatherName: regex },
      ];
    }

    const results = await Result.find(query).sort({ createdAt: -1 }).lean();

    return res.status(200).json({
      success: true,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Get Results Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch results",
    });
  }
};

const getResultById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid result id",
      });
    }

    const resultItem = await Result.findById(id);

    if (!resultItem) {
      return res.status(404).json({
        success: false,
        message: "Result not found",
      });
    }

    return res.status(200).json({
      success: true,
      resultItem,
    });
  } catch (error) {
    console.error("Get Result Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch result",
    });
  }
};

const getResultByStudent = async (req, res) => {
  try {
    const { studentId } = req.params;
    const registrationNumber = req.query.registrationNumber?.toString().trim();

    const query = {
      $or: [
        { studentId: studentId?.toString().trim() || "" },
        ...(registrationNumber ? [{ registrationNumber }] : []),
      ],
    };

    const resultItem = await Result.findOne(query).sort({ createdAt: -1 }).lean();

    if (!resultItem) {
      return res.status(200).json({
        success: true,
        resultItem: null,
        message: "Result not found for this student",
      });
    }

    return res.status(200).json({
      success: true,
      resultItem,
    });
  } catch (error) {
    console.error("Get Student Result Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch student result",
    });
  }
};

const upsertResult = async (req, res) => {
  try {
    const payload = buildPayload(req.body);

    if (
      !payload.studentId ||
      !payload.studentName ||
      !payload.registrationNumber ||
      !payload.className ||
      !payload.section
    ) {
      return res.status(400).json({
        success: false,
        message: "Student id, student name, registration number, class and section are required",
      });
    }

    const resultItem = await Result.findOneAndUpdate(
      {
        $or: [
          { studentId: payload.studentId },
          { registrationNumber: payload.registrationNumber },
        ],
      },
      payload,
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Result saved successfully",
      resultItem,
    });
  } catch (error) {
    console.error("Upsert Result Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to save result",
    });
  }
};

const updateResult = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid result id",
      });
    }

    const payload = buildPayload(req.body);
    const resultItem = await Result.findByIdAndUpdate(id, payload, {
      new: true,
      runValidators: true,
    });

    if (!resultItem) {
      return res.status(404).json({
        success: false,
        message: "Result not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Result updated successfully",
      resultItem,
    });
  } catch (error) {
    console.error("Update Result Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update result",
    });
  }
};

const deleteResult = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid result id",
      });
    }

    const resultItem = await Result.findByIdAndDelete(id);

    if (!resultItem) {
      return res.status(404).json({
        success: false,
        message: "Result not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Result deleted successfully",
    });
  } catch (error) {
    console.error("Delete Result Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete result",
    });
  }
};

export {
  createResult,
  getAllResults,
  getResultById,
  getResultByStudent,
  updateResult,
  upsertResult,
  deleteResult,
};
