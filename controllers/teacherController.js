import mongoose from "mongoose";
import Teacher from "../models/teacherModel.js";

const TEACHER_ID_PREFIX = "TECH-";

function normalizeTeacherBiometrics(biometricInfo = {}) {
  const fingerprintSamples = Array.isArray(biometricInfo.fingerprintSamples)
    ? biometricInfo.fingerprintSamples
        .map((sample, index) => ({
          step: Number(sample?.step) || index + 1,
          quality: Number(sample?.quality) || 0,
          capturedAt: sample?.capturedAt || null,
        }))
        .filter((sample) => sample.quality > 0)
    : [];
  const faceSamples = Array.isArray(biometricInfo.faceSamples)
    ? biometricInfo.faceSamples
        .map((sample, index) => ({
          step: Number(sample?.step) || index + 1,
          confidence: Number(sample?.confidence) || 0,
          capturedAt: sample?.capturedAt || null,
        }))
        .filter((sample) => sample.confidence > 0)
    : [];
  const fingerprint =
    typeof biometricInfo.fingerprint === "string"
      ? biometricInfo.fingerprint.trim()
      : biometricInfo.fingerprint?.templateId?.trim?.() || "";
  const facerecognition =
    typeof biometricInfo.facerecognition === "string"
      ? biometricInfo.facerecognition.trim()
      : biometricInfo.face?.faceId?.trim?.() || "";

  return {
    fingerprint,
    fingerprintEnrolled:
      Boolean(biometricInfo.fingerprintEnrolled) ||
      Boolean(biometricInfo.fingerprint?.enrolled) ||
      fingerprintSamples.length >= 5 ||
      Boolean(fingerprint),
    fingerprintCapturedAt:
      biometricInfo.fingerprintCapturedAt ||
      biometricInfo.fingerprint?.enrolledAt ||
      null,
    fingerprintSamples,
    facerecognition,
    faceEnrolled:
      Boolean(biometricInfo.faceEnrolled) ||
      Boolean(biometricInfo.face?.enrolled) ||
      faceSamples.length >= 5 ||
      Boolean(facerecognition),
    faceCapturedAt:
      biometricInfo.faceCapturedAt ||
      biometricInfo.face?.enrolledAt ||
      null,
    faceSamples,
  };
}

function normalizeTeacherIdValue(value) {
  const normalizedValue = String(value || "").trim().toUpperCase();
  if (!normalizedValue) return "";

  const numericMatch = normalizedValue.match(/(\d+)$/);
  if (!numericMatch) return normalizedValue;

  return `${TEACHER_ID_PREFIX}${numericMatch[1].padStart(3, "0")}`;
}

async function getNextTeacherId() {
  const teachersWithIds = await Teacher.find({
    teacherId: { $regex: `^${TEACHER_ID_PREFIX}\\d+$`, $options: "i" },
  })
    .select("teacherId")
    .lean();

  const highestSequence = teachersWithIds.reduce((maxValue, teacher) => {
    const currentSequence = Number(
      String(teacher?.teacherId || "")
        .replace(TEACHER_ID_PREFIX, "")
        .trim()
    );

    return Number.isFinite(currentSequence) ? Math.max(maxValue, currentSequence) : maxValue;
  }, 0);

  return `${TEACHER_ID_PREFIX}${String(highestSequence + 1).padStart(3, "0")}`;
}

async function ensureTeacherId(teacherDocument) {
  if (!teacherDocument) return teacherDocument;
  if (String(teacherDocument.teacherId || "").trim()) return teacherDocument;

  teacherDocument.teacherId = await getNextTeacherId();
  await teacherDocument.save();
  return teacherDocument;
}

const createTeacher = async (req, res) => {
  try {
    const { teacherId, personalInfo = {}, educationInfo = {}, biometricInfo = {}, classAssign = {}, salaryInfo = {}, status } =
      req.body;

    if (!personalInfo.name || !personalInfo.contactNumber) {
      return res.status(400).json({
        success: false,
        message: "Full name and contact number are required",
      });
    }

    if (personalInfo.cnic) {
      const existingTeacher = await Teacher.findOne({
        "personalInfo.cnic": personalInfo.cnic.trim(),
      });

      if (existingTeacher) {
        return res.status(409).json({
          success: false,
          message: "Teacher with this CNIC already exists",
        });
      }
    }

    if (personalInfo.email) {
      const existingEmail = await Teacher.findOne({
        "personalInfo.email": personalInfo.email.trim().toLowerCase(),
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Teacher with this email already exists",
        });
      }
    }

    const nextTeacherId = normalizeTeacherIdValue(teacherId) || (await getNextTeacherId());
    const existingTeacherId = await Teacher.findOne({ teacherId: nextTeacherId });
    if (existingTeacherId) {
      return res.status(409).json({
        success: false,
        message: "Teacher ID already exists",
      });
    }

    const normalizedBiometricInfo = normalizeTeacherBiometrics(biometricInfo);

    const teacher = await Teacher.create({
      teacherId: nextTeacherId,
      personalInfo: {
        name: personalInfo.name.trim(),
        fatherHusbandName: personalInfo.fatherHusbandName?.trim() || "",
        gender: personalInfo.gender || "Male",
        dob: personalInfo.dob || null,
        cnic: personalInfo.cnic?.trim() || "",
        contactNumber: personalInfo.contactNumber.trim(),
        email: personalInfo.email?.trim().toLowerCase() || "",
        address: personalInfo.address?.trim() || "",
        photo: personalInfo.photo || "",
      },
      educationInfo: {
        academicQualification: educationInfo.academicQualification?.trim() || "",
        majorSubject: educationInfo.majorSubject?.trim() || "",
        professionalQualification: educationInfo.professionalQualification?.trim() || "",
        dateOfAppointment: educationInfo.dateOfAppointment || null,
        experience: Number.isFinite(Number(educationInfo.experience))
          ? Number(educationInfo.experience)
          : 0,
        lastInstitute: educationInfo.lastInstitute?.trim() || "",
      },
      biometricInfo: {
        fingerprint: normalizedBiometricInfo.fingerprint,
        fingerprintEnrolled: normalizedBiometricInfo.fingerprintEnrolled,
        fingerprintCapturedAt: normalizedBiometricInfo.fingerprintCapturedAt,
        fingerprintSamples: normalizedBiometricInfo.fingerprintSamples,
        facerecognition: normalizedBiometricInfo.facerecognition,
        faceEnrolled: normalizedBiometricInfo.faceEnrolled,
        faceCapturedAt: normalizedBiometricInfo.faceCapturedAt,
        faceSamples: normalizedBiometricInfo.faceSamples,
      },
      classAssign: {
        teacherType: classAssign.teacherType || "Period Teacher",
        classIncharge: classAssign.classIncharge?.trim() || "",
        totalPeriods: Number.isFinite(Number(classAssign.totalPeriods))
          ? Number(classAssign.totalPeriods)
          : 0,
        periodsAssignments: Array.isArray(classAssign.periodsAssignments)
          ? classAssign.periodsAssignments
          : [],
      },
      salaryInfo: {
        basicSalary: Number.isFinite(Number(salaryInfo.basicSalary))
          ? Number(salaryInfo.basicSalary)
          : 0,
        houseRent: Number.isFinite(Number(salaryInfo.houseRent))
          ? Number(salaryInfo.houseRent)
          : 0,
        medicalAllowance: Number.isFinite(Number(salaryInfo.medicalAllowance))
          ? Number(salaryInfo.medicalAllowance)
          : 0,
        conveyanceAllowance: Number.isFinite(Number(salaryInfo.conveyanceAllowance))
          ? Number(salaryInfo.conveyanceAllowance)
          : 0,
        otherAllowances: Number.isFinite(Number(salaryInfo.otherAllowances))
          ? Number(salaryInfo.otherAllowances)
          : 0,
        totalSalary: Number.isFinite(Number(salaryInfo.totalSalary))
          ? Number(salaryInfo.totalSalary)
          : 0,
        bankName: salaryInfo.bankName?.trim() || "",
        accountTitle: salaryInfo.accountTitle?.trim() || "",
        bankAccount: salaryInfo.bankAccount?.trim() || "",
      },
      status: status || "Active",
    });

    return res.status(201).json({
      success: true,
      message: "Teacher created successfully",
      teacher,
    });
  } catch (error) {
    console.error("Create Teacher Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create teacher",
    });
  }
};

const getAllTeachers = async (req, res) => {
  try {
    const { status, teacherType, search } = req.query;

    const query = {};

    if (status) {
      query.status = status;
    }

    if (teacherType) {
      query["classAssign.teacherType"] = teacherType;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { teacherId: regex },
        { "personalInfo.name": regex },
        { "personalInfo.fatherHusbandName": regex },
        { "personalInfo.cnic": regex },
        { "personalInfo.contactNumber": regex },
        { "personalInfo.email": regex },
        { "educationInfo.majorSubject": regex },
        { "educationInfo.lastInstitute": regex },
      ];
    }

    const teachers = await Teacher.find(query).sort({ createdAt: -1 });
    for (const teacher of teachers) {
      await ensureTeacherId(teacher);
    }

    return res.status(200).json({
      success: true,
      total: teachers.length,
      teachers,
    });
  } catch (error) {
    console.error("Get Teachers Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch teachers",
    });
  }
};

const getTeacherById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher id",
      });
    }

    const teacher = await Teacher.findById(id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    await ensureTeacherId(teacher);

    return res.status(200).json({
      success: true,
      teacher,
    });
  } catch (error) {
    console.error("Get Teacher Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch teacher",
    });
  }
};

const updateTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher id",
      });
    }

    const nextCnic = req.body?.personalInfo?.cnic?.trim();
    if (nextCnic) {
      const existingCnic = await Teacher.findOne({
        "personalInfo.cnic": nextCnic,
        _id: { $ne: id },
      });

      if (existingCnic) {
        return res.status(409).json({
          success: false,
          message: "Another teacher with this CNIC already exists",
        });
      }
    }

    const nextEmail = req.body?.personalInfo?.email?.trim().toLowerCase();
    if (nextEmail) {
      const existingEmail = await Teacher.findOne({
        "personalInfo.email": nextEmail,
        _id: { $ne: id },
      });

      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Another teacher with this email already exists",
        });
      }
    }

    const existingTeacher = await Teacher.findById(id);
    if (!existingTeacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    await ensureTeacherId(existingTeacher);

    const nextBody = {
      ...req.body,
      teacherId: existingTeacher.teacherId,
      biometricInfo: normalizeTeacherBiometrics(req.body?.biometricInfo || {}),
    };

    const teacher = await Teacher.findByIdAndUpdate(id, nextBody, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Teacher updated successfully",
      teacher,
    });
  } catch (error) {
    console.error("Update Teacher Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update teacher",
    });
  }
};

const deleteTeacher = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid teacher id",
      });
    }

    const teacher = await Teacher.findByIdAndDelete(id);

    if (!teacher) {
      return res.status(404).json({
        success: false,
        message: "Teacher not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Teacher deleted successfully",
    });
  } catch (error) {
    console.error("Delete Teacher Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete teacher",
    });
  }
};

export {
  createTeacher,
  getAllTeachers,
  getTeacherById,
  updateTeacher,
  deleteTeacher,
};
