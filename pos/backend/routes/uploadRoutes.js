const express = require("express");
const { uploadImage } = require("../controllers/uploadController");

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

module.exports = router;

