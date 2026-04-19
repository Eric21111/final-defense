const cloudinary = require("cloudinary").v2;

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

let configured = false;

function ensureCloudinaryConfigured() {
  if (configured) return;

  if (!cloudName || !apiKey || !apiSecret) {
    const missing = [
      !cloudName ? "CLOUDINARY_CLOUD_NAME" : null,
      !apiKey ? "CLOUDINARY_API_KEY" : null,
      !apiSecret ? "CLOUDINARY_API_SECRET" : null,
    ].filter(Boolean);
    const err = new Error(
      `Cloudinary is not configured. Missing env vars: ${missing.join(", ")}`,
    );
    err.code = "CLOUDINARY_NOT_CONFIGURED";
    throw err;
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  configured = true;
}

module.exports = { cloudinary, ensureCloudinaryConfigured };

