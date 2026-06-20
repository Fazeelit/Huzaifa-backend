const parseUrlList = (value) =>
  String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export default {
  port: process.env.PORT || 8080,
  host: process.env.HOST || "127.0.0.1",

  // MongoDB
  mongodbUri:
    process.env.MONGO_DIRECT_URI ||
    process.env.MONGO_URI ||
    "mongodb://127.0.0.1:27017/Darazdb",

  // JWT
  jwtSecret: process.env.JWT_SECRET || "default_secret_key",
  jwtAlgorithm: process.env.JWT_ALGORITHM || "HS256",
  jwtExpiresIn: process.env.JWT_EXPIRE_IN || "1h",
  jwtIssuer: process.env.JWT_ISSUER || "default_issuer",
  jwtAudience: process.env.JWT_AUDIENCE || "default_audience",

  // Email (optional)
  emailHost: process.env.EMAIL_HOST,
  emailPort: process.env.EMAIL_PORT,
  emailUser: process.env.EMAIL_USER,
  emailPassword: process.env.EMAIL_PASSWORD,
  emailFrom: process.env.EMAIL_FROM,

  // Frontend URLs (CORS)
  webAppUrl: parseUrlList(process.env.WEBAPP_URL),

  // Cloudinary
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
};
