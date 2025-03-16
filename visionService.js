const vision = require("@google-cloud/vision");
const path = require("path");
require("dotenv").config();

const client = new vision.ImageAnnotatorClient({
  keyFilename: path.join(__dirname, "gcp-key.json"), // Update with correct filename
});

module.exports = client;
