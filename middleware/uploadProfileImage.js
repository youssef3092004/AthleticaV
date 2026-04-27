import multer from "multer";
import path from "path";
import fs from "fs";

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/profiles";
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "profile-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedMimes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExt = allowedExtensions.includes(ext);
  const isValidMime = allowedMimes.includes(file.mimetype);

  if (isValidExt && isValidMime) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (jpg, png, gif, webp) are allowed"), false);
  }
};

// Create multer instance
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

export const uploadProfileImage = upload.single("profileImage");

/**
 * Convert uploaded file to URL for storage in database
 * In production, consider uploading to cloud storage (S3, CloudFlare, etc.)
 */
export const getProfileImageUrl = (file) => {
  if (!file) return null;

  // Local file path approach
  // In production, upload to cloud and return cloud URL
  return `/uploads/profiles/${file.filename}`;
};
