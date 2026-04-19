const { cloudinary, ensureCloudinaryConfigured } = require("../config/cloudinary");

function badRequest(res, message, extra = {}) {
  return res.status(400).json({ success: false, message, ...extra });
}

exports.uploadImage = async (req, res) => {
  try {
    ensureCloudinaryConfigured();

    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || buf.length === 0) return badRequest(res, "No file uploaded");

    const mime = String(req.headers["content-type"] || "");
    if (!mime.startsWith("image/")) {
      return badRequest(res, "Only image uploads are allowed");
    }

    const folder =
      String(process.env.CLOUDINARY_FOLDER || "pos-system").trim() ||
      "pos-system";

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: "image", overwrite: false },
        (err, res) => {
          if (err) return reject(err);
          return resolve(res);
        },
      );
      stream.end(buf);
    });

    return res.json({
      success: true,
      url: result.secure_url || result.url,
      publicId: result.public_id,
      width: result.width,
      height: result.height,
      format: result.format,
      bytes: result.bytes,
    });
  } catch (error) {
    const code = error?.code;
    if (code === "CLOUDINARY_NOT_CONFIGURED") {
      return res.status(503).json({
        success: false,
        message: error.message,
      });
    }
    console.error("[uploadImage] Failed:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Upload failed",
    });
  }
};

