import dotenv from "dotenv";
import path from "path";

// Load the main .env file (since you currently have only .env)
dotenv.config({ path: path.resolve(".env") });

console.log(`✅ Loaded environment variables from .env`);

export default {
  port: process.env.PORT || 3000,
  host: process.env.HOST || "127.0.0.1",

  // MongoDB
  mongodbUri: process.env.MONGO_URI ,

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
  webAppUrl: process.env.WEBAPP_URL ? process.env.WEBAPP_URL.split(",") : [],

  // Cloudinary
  cloudinary: {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  },
};
