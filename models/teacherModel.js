import mongoose from "mongoose";

const periodAssignmentSchema = new mongoose.Schema(
  {
    period: {
      type: String,
      trim: true,
    },
    class: {
      type: String,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
    },
    time: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      trim: true,
      default: "Period",
    },
  },
  { _id: false }
);

const biometricSampleSchema = new mongoose.Schema(
  {
    step: {
      type: Number,
      min: 1,
    },
    quality: {
      type: Number,
      min: 0,
      max: 100,
    },
    confidence: {
      type: Number,
      min: 0,
      max: 100,
    },
    capturedAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const teacherSchema = new mongoose.Schema(
  {
    teacherId: {
      type: String,
      trim: true,
      uppercase: true,
      unique: true,
      sparse: true,
      immutable: true,
    },
    personalInfo: {
      name: {
        type: String,
        required: true,
        trim: true,
      },
      fatherHusbandName: {
        type: String,
        trim: true,
      },
      gender: {
        type: String,
        enum: ["Male", "Female", "Other"],
        default: "Male",
      },
      dob: {
        type: Date,
        default: null,
      },
      cnic: {
        type: String,
        trim: true,
      },
      contactNumber: {
        type: String,
        required: true,
        trim: true,
      },
      email: {
        type: String,
        trim: true,
        lowercase: true,
      },
      address: {
        type: String,
        trim: true,
      },
      photo: {
        type: String,
        default: "",
      },
    },
    educationInfo: {
      academicQualification: {
        type: String,
        trim: true,
      },
      majorSubject: {
        type: String,
        trim: true,
      },
      professionalQualification: {
        type: String,
        trim: true,
      },
      dateOfAppointment: {
        type: Date,
        default: null,
      },
      experience: {
        type: Number,
        default: 0,
        min: 0,
      },
      lastInstitute: {
        type: String,
        trim: true,
      },
    },
    biometricInfo: {
      fingerprint: {
        type: String,
        trim: true,
        default: "",
      },
      fingerprintEnrolled: {
        type: Boolean,
        default: false,
      },
      fingerprintCapturedAt: {
        type: Date,
        default: null,
      },
      fingerprintSamples: {
        type: [biometricSampleSchema],
        default: [],
      },
      facerecognition: {
        type: String,
        trim: true,
        default: "",
      },
      faceEnrolled: {
        type: Boolean,
        default: false,
      },
      faceCapturedAt: {
        type: Date,
        default: null,
      },
      faceSamples: {
        type: [biometricSampleSchema],
        default: [],
      },
    },
    classAssign: {
      teacherType: {
        type: String,
        enum: ["Period Teacher", "Class Incharge"],
        default: "Period Teacher",
      },
      classIncharge: {
        type: String,
        trim: true,
        default: "",
      },
      totalPeriods: {
        type: Number,
        default: 0,
        min: 0,
      },
      periodsAssignments: {
        type: [periodAssignmentSchema],
        default: [],
      },
    },
    salaryInfo: {
      basicSalary: {
        type: Number,
        default: 0,
        min: 0,
      },
      houseRent: {
        type: Number,
        default: 0,
        min: 0,
      },
      medicalAllowance: {
        type: Number,
        default: 0,
        min: 0,
      },
      conveyanceAllowance: {
        type: Number,
        default: 0,
        min: 0,
      },
      otherAllowances: {
        type: Number,
        default: 0,
        min: 0,
      },
      totalSalary: {
        type: Number,
        default: 0,
        min: 0,
      },
      bankName: {
        type: String,
        trim: true,
      },
      accountTitle: {
        type: String,
        trim: true,
      },
      bankAccount: {
        type: String,
        trim: true,
      },
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
  },
  { timestamps: true }
);

const Teacher =
  mongoose.models.Teacher || mongoose.model("Teacher", teacherSchema);

export default Teacher;
