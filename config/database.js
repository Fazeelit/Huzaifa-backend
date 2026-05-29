import mongoose from "mongoose";

const LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/Huzaifa-Autos";

const normalizeMongoUri = (uri) =>
  uri?.replace(/^(mongodb(?:\+srv)?:\/\/[^/]+)\/+/, "$1/");

const getMongoUri = () =>
  normalizeMongoUri(
    process.env.MONGO_DIRECT_URI ||
      process.env.MONGO_URI ||
      LOCAL_MONGO_URI,
  );

const maskMongoUri = (uri) =>
  uri?.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");

const logConnectionHint = (uri, error) => {
  const isSrvUri = uri?.startsWith("mongodb+srv://");

  if (error?.message?.includes("querySrv ECONNREFUSED") && isSrvUri) {
    console.error(
      "ℹ️ This URI uses MongoDB Atlas SRV DNS lookup, and Node.js could not resolve the SRV record.",
    );
    console.error(
      "ℹ️ Try one of these fixes: use a direct Atlas URI in MONGO_DIRECT_URI, switch to Node.js 20/22 LTS, or verify local DNS/firewall/proxy settings.",
    );
  }
};

const dbConnect = async () => {
  const mongoUri = getMongoUri();

  if (!mongoUri) {
    console.error("❌ MongoDB URI is not configured.");
    console.error(
      "ℹ️ Set MONGO_URI, set MONGO_DIRECT_URI, or run a local MongoDB instance on mongodb://127.0.0.1:27017/Darazdb.",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
    });

    console.log(`✅ MongoDB connected successfully`);

    mongoose.connection.on("error", (err) => {
      console.error("❌ MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️ MongoDB disconnected");
    });
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    console.error(`ℹ️ Attempted URI: ${maskMongoUri(mongoUri)}`);
    logConnectionHint(mongoUri, error);
    process.exit(1);
  }
};

export default dbConnect;
