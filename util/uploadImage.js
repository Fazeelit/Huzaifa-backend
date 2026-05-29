import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import config from "../config/config.js";

// Configure Cloudinary
cloudinary.config({
  cloud_name: config.cloudinary.cloud_name,
  api_key: config.cloudinary.api_key,
  api_secret: config.cloudinary.api_secret,
});

// Multer memory storage (store file in memory for direct upload)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 90 * 1024 * 1024 }, // 90MB limit
});

// Upload middleware
const uploadImage = (fieldName = "file") => {
  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: "File upload failed", details: err.message });
      }

      if (!req.file) return next(); // No file uploaded

      // Upload buffer to Cloudinary
      const stream = cloudinary.uploader.upload_stream(
        { folder: "reports" },
        (error, result) => {
          if (error) {
            console.error("❌ Cloudinary upload failed:", error);
            return res.status(500).json({ error: "Failed to upload to Cloudinary" });
          }
          req.fileUrl = result.secure_url; // Pass the uploaded file URL
          next();
        }
      );

      stream.end(req.file.buffer); // Pipe the buffer into the Cloudinary stream
    });
  };
};

export default uploadImage;
