const vision = require("@google-cloud/vision");
require("dotenv").config();

// Decode the Base64 key from the environment variable
const decodedKey = Buffer.from(process.env.GCP_KEY_BASE64, "base64").toString("utf8");
const credentials = JSON.parse(decodedKey);

// Initialize Google Cloud Vision client with credentials
const client = new vision.ImageAnnotatorClient({ credentials });

module.exports = client;
