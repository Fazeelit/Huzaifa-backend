import express from "express";
import morgan from "morgan";
import cors from "cors";
import http from "http";
import "./config/loadEnv.js";

// ------------------ Database ------------------
import dbConnect from "./config/database.js";
dbConnect();

// ------------------ Config ------------------
import config from "./config/config.js";

// ------------------ Routes ------------------
import productRoutes from "./routes/productsRoutes.js";
import purchaseRoutes from "./routes/purchaseRoutes.js";
import salesRoutes from "./routes/salesRoutes.js";
import expenseRoutes from "./routes/expenseRoutes.js";
import userManagementRoutes from "./routes/UserManagementRoutes.js";
import roleRoutes from "./routes/RoleRoutes.js";
import supplierRoutes from "./routes/supplierRoutes.js";
import supplierPaymentRoutes from "./routes/supplierPaymentRoutes.js";
import customerPaymentRoutes from "./routes/customerPaymentRoutes.js";
import inventoryRoutes from "./routes/inventoryRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import outdoorSupplyManagementRoutes from "./routes/outdoorSupplyManagementRoutes.js";

const app = express();

/*
=====================================================
 CORS Middleware (LAN Safe Production Version)
=====================================================
*/
// ------------------ CORS Setup ------------------
const normalizeOrigin = (origin) => String(origin || "").trim().replace(/\/+$/, "");

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "https://huzaifa-autoz01-feroza.vercel.app",
];

const allowedOrigins = new Set(
  [...defaultAllowedOrigins, ...config.webAppUrl]
    .filter(Boolean)
    .map(normalizeOrigin),
);

const isAllowedOrigin = (origin) => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  // Allow Vercel preview deployments for the same app family.
  return /^https:\/\/huzaifa-autos(?:-.*)?\.vercel\.app$/i.test(normalizedOrigin);
};

app.use(
  cors({
    origin(origin, callback) {
      // Allow server-to-server requests and same-origin tools with no Origin header.
      if (!origin) {
        return callback(null, true);
      }

      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      console.error(`Blocked by CORS: ${origin}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

/*
=====================================================
 Express Middleware
=====================================================
*/

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

/*
=====================================================
 Root Route
=====================================================
*/

app.get("/", (req, res) => {
  res.send("Backend is running");
});

app.get("/api", (req, res) => {
  res.json({ message: "API is running" });
});

/*
=====================================================
 API Routes
=====================================================
*/

app.use("/api/user-management", userManagementRoutes);
app.use("/api/products", productRoutes);
app.use("/api/purchases", purchaseRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/suppliers", supplierRoutes);
app.use("/api/supplierpayments", supplierPaymentRoutes);
app.use("/api/customerpayments", customerPaymentRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/customers", customerRoutes);
app.use("/api/outdoor-supply-management", outdoorSupplyManagementRoutes);

/*
=====================================================
 404 API Handler
=====================================================
*/

app.all(/^\/api\/.*/, (req, res) => {
  res.status(404).json({ message: "API route not found" });
});

/*
=====================================================
 Global Error Handler
=====================================================
*/

app.use((err, req, res, next) => {
  console.error("Server Error:", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: err.message });
  }

  res.status(err.statusCode || 500).json({
    message: err.message || "Internal Server Error",
  });
});

/*
=====================================================
 Server Start
=====================================================
*/

const PORT = config.port || 8080;
const HOST = "0.0.0.0";

const server = http.createServer(app);

server.timeout = 5 * 60 * 1000;

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
