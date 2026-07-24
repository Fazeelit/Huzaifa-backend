// server.js
import express from "express";
import morgan from "morgan";
import cors from "cors";
import http from "http";

// ------------------ Database ------------------
import dbConnect from "./config/database.js";

// ------------------ Config ------------------
import config from "./config/config.js";

// ------------------ Routes ------------------
import userManagementRoutes from "./routes/UserManagementRoutes.js";
import roleRoutes from "./routes/RoleRoutes.js";
import teacherRoutes from "./routes/teacherRoute.js";
import classRoutes from "./routes/classRoute.js";
import studentRoutes from "./routes/studentRoute.js";
import resultRoutes from "./routes/resultRoute.js";
import feeRoutes from "./routes/feeRoute.js";
import attendanceRoutes from "./routes/attendanceRoute.js";
import timetableRoutes from "./routes/timetableRoute.js";
import expenseRoutes from "./routes/expenseRoute.js";
import Role from "./models/roleModel.js";
import { SCHOOL_PERMISSION_KEYS } from "./constants/accessControl.js";

const app = express();
const explicitAllowedOrigins = new Set([
  "http://localhost:3000",
  "http://localhost:3000/",
]);

const DEFAULT_ROLE_SEED = [
  {
    role: "ADMIN",
    description: "Full system access for school administration.",
    permissions: SCHOOL_PERMISSION_KEYS,
    status: "ACTIVE",
  },
  {
    role: "CLERK",
    description: "Can manage daily school office tasks and operational records.",
    permissions: ["DASHBOARD_VIEW", "CLASSES_VIEW", "STUDENTS_VIEW", "FEES_VIEW", "ATTENDANCE_VIEW"],
    status: "ACTIVE",
  },
  {
    role: "PRINCIPAL",
    description: "Can supervise school operations and review administrative reports.",
    permissions: SCHOOL_PERMISSION_KEYS,
    status: "ACTIVE",
  },
  {
    role: "TEACHERS",
    description: "Can access teacher-related workflows and assigned academic tasks.",
    permissions: ["DASHBOARD_VIEW", "STUDENTS_VIEW", "RESULTS_VIEW", "ATTENDANCE_VIEW", "TIMETABLE_VIEW"],
    status: "ACTIVE",
  },
  {
    role: "STUDENTS",
    description: "Can access student-related records and limited academic features.",
    permissions: ["DASHBOARD_VIEW", "RESULTS_VIEW", "FEES_VIEW", "ATTENDANCE_VIEW", "TIMETABLE_VIEW"],
    status: "ACTIVE",
  },
];

async function ensureDefaultRoles() {
  try {
    for (const roleData of DEFAULT_ROLE_SEED) {
      await Role.updateOne(
        { role: roleData.role },
        { $setOnInsert: roleData },
        { upsert: true }
      );
    }
  } catch (error) {
    console.error("Failed to seed default roles:", error);
  }
}

async function loadOptionalRoute(modulePath, label) {
  try {
    const module = await import(modulePath);
    return module.default;
  } catch (error) {
    if (error?.code === "ERR_MODULE_NOT_FOUND") {
      console.warn(`Optional route skipped: ${label} (${modulePath})`);
      return null;
    }
    throw error;
  }
}


const configuredOriginHosts = new Set(
  (config.webAppUrl || [])
    .map((value) => {
      try {
        return new URL(value).hostname;
      } catch {
        return null;
      }
    })
    .filter(Boolean)
);

configuredOriginHosts.add("localhost");
configuredOriginHosts.add("127.0.0.1");
configuredOriginHosts.add(process.env.ELECTRON_APP_HOST || "192.168.100.78");

function isAllowedOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (explicitAllowedOrigins.has(origin)) {
    return true;
  }

  try {
    const { hostname } = new URL(origin);

    if (configuredOriginHosts.has(hostname) || origin.endsWith(".vercel.app")) {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

const corsOptions = {
  origin: function (origin, callback) {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// ------------------ CORS ------------------
app.use(cors(corsOptions));

// Express 5 compatible preflight handler
app.options(/.*/, cors(corsOptions));

// ------------------ Middleware ------------------
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// ------------------ Root Route ------------------
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// ------------------ API Routes ------------------
app.use("/api/user-management", userManagementRoutes);
app.use("/api/users", userManagementRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/role-management", roleRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/results", resultRoutes);
app.use("/api/fees", feeRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/timetables", timetableRoutes);
app.use("/api/expenses", expenseRoutes);


// ------------------ 404 API Handler ------------------
app.all(/^\/api\/.*$/, (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

// ------------------ Global Error Handler ------------------
app.use((err, req, res, next) => {
  console.error("Error:", err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: err.message });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
});

// ------------------ Server ------------------
const PORT = config.port || 8080;
const HOST = "0.0.0.0";
const isDevRuntime = process.env.NODE_ENV === "development" || process.env.npm_lifecycle_event === "dev";

const server = http.createServer(app);

// Optional: increase timeout
server.timeout = 5 * 60 * 1000;

function listenOnPort(port) {
  return new Promise((resolve, reject) => {
    const handleListening = () => {
      server.off("error", handleError);
      resolve(port);
    };

    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };

    server.once("listening", handleListening);
    server.once("error", handleError);
    server.listen(port, HOST);
  });
}

async function startServer() {
  const maxPortAttempts = isDevRuntime ? 10 : 1;

  for (let attempt = 0; attempt < maxPortAttempts; attempt += 1) {
    const port = Number(PORT) + attempt;

    try {
      return await listenOnPort(port);
    } catch (error) {
      if (error?.code === "EADDRINUSE" && attempt < maxPortAttempts - 1) {
        console.warn(`Port ${port} is already in use. Retrying on ${port + 1}.`);
        continue;
      }

      throw error;
    }
  }
}

async function bootstrap() {
  const isDatabaseConnected = await dbConnect();

  if (isDatabaseConnected) {
    await ensureDefaultRoles();
  } else {
    console.warn("Skipping default role seeding because MongoDB is unavailable.");
  }

  const activePort = await startServer();
  console.log(`Server running at http://192.168.100.78:${activePort}`);
  if (!isDatabaseConnected) {
    console.warn("API started without MongoDB. Database-backed routes will fail until the connection issue is resolved.");
  }
}

bootstrap().catch((error) => {
  console.error("Server bootstrap failed:", error);
  process.exit(1);
});
