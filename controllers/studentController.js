import mongoose from "mongoose";
import Student from "../models/studentModel.js";

const createStudent = async (req, res) => {
  try {
    const {
      fullName,
      gender,
      dob,
      cnicBForm,
      phoneNumber,
      email,
      address,
      fatherName,
      fatherCNIC,
      fatherPhone,
      motherName,
      motherPhone,
      whatsappNumber,
      monthlyIncome,
      registrationNumber,
      enrollmentClass,
      previousClass,
      previousSchool,
      fee,
      biometric,
      feeRecords,
      photo,
      status,
    } = req.body;

    if (!fullName || !fatherName || !enrollmentClass || !registrationNumber) {
      return res.status(400).json({
        success: false,
        message:
          "Full name, father's name, registration number, and enrollment class are required",
      });
    }

    const existingRegistration = await Student.findOne({
      registrationNumber: registrationNumber.trim(),
    });
    if (existingRegistration) {
      return res.status(409).json({
        success: false,
        message: "Student with this registration number already exists",
      });
    }

    if (email) {
      const existingEmail = await Student.findOne({
        email: email.trim().toLowerCase(),
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Student with this email already exists",
        });
      }
    }

    const student = await Student.create({
      fullName: fullName.trim(),
      gender: gender || "Male",
      dob: dob || null,
      cnicBForm: cnicBForm?.trim() || "",
      phoneNumber: phoneNumber?.trim() || "",
      email: email?.trim().toLowerCase() || "",
      address: address?.trim() || "",
      fatherName: fatherName.trim(),
      fatherCNIC: fatherCNIC?.trim() || "",
      fatherPhone: fatherPhone?.trim() || "",
      motherName: motherName?.trim() || "",
      motherPhone: motherPhone?.trim() || "",
      whatsappNumber: whatsappNumber?.trim() || "",
      monthlyIncome: Number.isFinite(Number(monthlyIncome)) ? Number(monthlyIncome) : 0,
      registrationNumber: registrationNumber.trim(),
      enrollmentClass: enrollmentClass.trim(),
      previousClass: previousClass?.trim() || "",
      previousSchool: previousSchool?.trim() || "",
      fee: {
        registrationFee: Number.isFinite(Number(fee?.registrationFee))
          ? Number(fee.registrationFee)
          : 0,
        monthlyFee: Number.isFinite(Number(fee?.monthlyFee))
          ? Number(fee.monthlyFee)
          : 0,
        mode: fee?.mode || "Monthly",
        discount: Number.isFinite(Number(fee?.discount)) ? Number(fee.discount) : 0,
        annualDiscount: Number.isFinite(Number(fee?.annualDiscount))
          ? Number(fee.annualDiscount)
          : 0,
      },
      biometric: {
        fingerprintEnrolled: Boolean(biometric?.fingerprintEnrolled),
        faceEnrolled: Boolean(biometric?.faceEnrolled),
        fingerprintTemplate: biometric?.fingerprintTemplate || "",
        faceTemplate: biometric?.faceTemplate || "",
      },
      feeRecords: Array.isArray(feeRecords) ? feeRecords : [],
      photo: photo || "",
      status: status || "Active",
    });

    return res.status(201).json({
      success: true,
      message: "Student created successfully",
      student,
    });
  } catch (error) {
    console.error("Create Student Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create student",
    });
  }
};

const getAllStudents = async (req, res) => {
  try {
    const { status, enrollmentClass, search } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (enrollmentClass) {
      query.enrollmentClass = enrollmentClass;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [
        { fullName: regex },
        { fatherName: regex },
        { registrationNumber: regex },
        { cnicBForm: regex },
        { phoneNumber: regex },
        { email: regex },
      ];
    }

    const students = await Student.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      total: students.length,
      students,
    });
  } catch (error) {
    console.error("Get Students Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch students",
    });
  }
};

const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    const student = await Student.findById(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      student,
    });
  } catch (error) {
    console.error("Get Student Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch student",
    });
  }
};

const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    const nextRegistrationNumber = req.body?.registrationNumber?.trim();
    if (nextRegistrationNumber) {
      const existingRegistration = await Student.findOne({
        registrationNumber: nextRegistrationNumber,
        _id: { $ne: id },
      });
      if (existingRegistration) {
        return res.status(409).json({
          success: false,
          message: "Another student with this registration number already exists",
        });
      }
    }

    const nextEmail = req.body?.email?.trim().toLowerCase();
    if (nextEmail) {
      const existingEmail = await Student.findOne({
        email: nextEmail,
        _id: { $ne: id },
      });
      if (existingEmail) {
        return res.status(409).json({
          success: false,
          message: "Another student with this email already exists",
        });
      }
    }

    const student = await Student.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student updated successfully",
      student,
    });
  } catch (error) {
    console.error("Update Student Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update student",
    });
  }
};

const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid student id",
      });
    }

    const student = await Student.findByIdAndDelete(id);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Student deleted successfully",
    });
  } catch (error) {
    console.error("Delete Student Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to delete student",
    });
  }
};

export {
  createStudent,
  getAllStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
};
