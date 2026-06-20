import mongoose from "mongoose";

const LOCAL_MONGO_URI = "mongodb://127.0.0.1:27017/huzaif-Autos";

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

const isSrvResolutionError = (error) =>
  /querySrv|ECONNREFUSED/i.test(String(error?.message || ""));

const getMongoDbName = (uri) => {
  try {
    const parsedUrl = new URL(uri);
    const dbName = parsedUrl.pathname.replace(/^\/+/, "").trim();
    return dbName || undefined;
  } catch {
    return undefined;
  }
};

const buildDirectAtlasUri = (uri) => {
  if (!uri?.startsWith("mongodb+srv://")) {
    return null;
  }

  try {
    const parsedUrl = new URL(uri);
    const databaseName = parsedUrl.pathname.replace(/^\/+/, "").trim();
    const username = parsedUrl.username;
    const password = parsedUrl.password;
    const hostParts = parsedUrl.hostname.split(".");

    if (hostParts.length < 3) {
      return null;
    }

    const clusterName = hostParts[0];
    const domainSuffix = hostParts.slice(1).join(".");
    const directHosts = [0, 1, 2]
      .map((index) => `${clusterName}-shard-00-0${index}.${domainSuffix}:27017`)
      .join(",");

    const authPart =
      username || password ? `${username}:${password}@` : "";
    const dbPath = databaseName ? `/${databaseName}` : "/";

    return normalizeMongoUri(
      `mongodb://${authPart}${directHosts}${dbPath}?tls=true&authSource=admin&retryWrites=true&w=majority`,
    );
  } catch {
    return null;
  }
};

const registerConnectionLogging = () => {
  mongoose.connection.removeAllListeners("error");
  mongoose.connection.removeAllListeners("disconnected");

  mongoose.connection.on("error", (err) => {
    console.error("MongoDB connection error:", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("MongoDB disconnected");
  });
};

const logConnectionHint = (uri, error) => {
  const isSrvUri = uri?.startsWith("mongodb+srv://");

  if (error?.message?.includes("querySrv ECONNREFUSED") && isSrvUri) {
    console.error(
      "This URI uses MongoDB Atlas SRV DNS lookup, and Node.js could not resolve the SRV record.",
    );
    console.error(
      "Try one of these fixes: use a direct Atlas URI in MONGO_DIRECT_URI, switch to Node.js 20/22 LTS, or verify local DNS/firewall/proxy settings.",
    );
  }
};

const dbConnect = async () => {
  const mongoUri = getMongoUri();
  const dbName = getMongoDbName(mongoUri);

  if (!mongoUri) {
    console.error("MongoDB URI is not configured.");
    console.error(
      "Set MONGO_URI, set MONGO_DIRECT_URI, or run a local MongoDB instance on mongodb://127.0.0.1:27017/Huzaifa-Autos.",
    );
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      dbName,
    });

    console.log("MongoDB connected successfully");
    registerConnectionLogging();
    return;
  } catch (error) {
    const fallbackUri = buildDirectAtlasUri(mongoUri);

    if (fallbackUri && isSrvResolutionError(error)) {
      try {
        await mongoose.connect(fallbackUri, {
          serverSelectionTimeoutMS: 10000,
          dbName: getMongoDbName(fallbackUri) || dbName,
        });

        console.log("MongoDB connected successfully using direct Atlas hosts");
        registerConnectionLogging();
        return;
      } catch (fallbackError) {
        console.error("MongoDB direct-host fallback failed:", fallbackError.message);
        console.error(`Attempted fallback URI: ${maskMongoUri(fallbackUri)}`);
      }
    }

    console.error("MongoDB connection failed:", error.message);
    console.error(`Attempted URI: ${maskMongoUri(mongoUri)}`);
    logConnectionHint(mongoUri, error);
    process.exit(1);
  }
};

export default dbConnect;
