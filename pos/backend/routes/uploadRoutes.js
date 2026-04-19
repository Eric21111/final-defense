const express = require("express");
const { uploadImage, deleteImage } = require("../controllers/uploadController");

const router = express.Router();

// Accept raw binary body for an image file.
router.post(
  "/image",
  express.raw({
    type: ["image/*", "application/octet-stream"],
    limit: "8mb",
  }),
  uploadImage,
);
router.delete("/image", deleteImage);

module.exports = router;

