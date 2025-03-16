const express = require("express");
const multer = require("multer");
const cors = require("cors");
const visionClient = require("./visionService");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors({ origin: "*" }));

// Multer setup
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

app.post("/", upload.single("image"), async (req, res) => {
    try {
        console.log("File received:", req.file);
        if (!req.file) return res.status(400).json({ error: "No image uploaded" });

        const image = req.file.buffer.toString("base64");

        // Call multiple Google Vision features
        const [result] = await visionClient.annotateImage({
            image: { content: image },
            features: [
                { type: "LABEL_DETECTION", maxResults: 15 },  // Increased from 10 to 15
                { type: "FACE_DETECTION" },
                { type: "OBJECT_LOCALIZATION" },
                { type: "WEB_DETECTION", maxResults: 5 }
            ]
        });

        // Extract labels (general classification)
        const labels = result.labelAnnotations.map(label => label.description);
        
        // Get detected objects with scores
        const objectAnnotations = result.localizedObjectAnnotations || [];
        const detectedObjects = objectAnnotations.map(obj => ({
            name: obj.name,
            score: obj.score
        }));
        
        // Sort objects by confidence score
        const sortedObjects = detectedObjects.sort((a, b) => b.score - a.score);
        
        // Determine main object (the one with highest confidence)
        const mainObject = sortedObjects.length > 0 ? sortedObjects[0].name : null;
        
        // Determine if animal and what type
        const animalLabels = ['animal', 'mammal', 'wildlife', 'fauna', 'zoo', 'pet'];
        const isAnimal = labels.some(label => 
            animalLabels.includes(label.toLowerCase())
        );
        
        // Common animal types to look for
        const specificAnimals = [
            'cow', 'dog', 'cat', 'horse', 'sheep', 'goat', 'pig', 'bird',
            'elephant', 'lion', 'tiger', 'bear', 'deer', 'rabbit', 'fox'
        ];
        
        let animalType = null;
        for (const label of labels) {
            const lowerLabel = label.toLowerCase();
            if (specificAnimals.includes(lowerLabel)) {
                animalType = lowerLabel;
                break;
            }
            
            // Check for variations like "dairy cattle" for cow
            if (lowerLabel.includes('cattle') || lowerLabel.includes('bovine')) {
                animalType = 'cow';
                break;
            }
        }
        
        // Determine category
        let category = "Object";
        if (isAnimal || animalType) {
            category = "Animal";
            if (animalType) {
                category = animalType.charAt(0).toUpperCase() + animalType.slice(1);
            }
        } else if (result.faceAnnotations && result.faceAnnotations.length > 0) {
            category = "Human";
        }
        
        // Create user-friendly description
        let detectedEntity = "Could not determine specific entity.";
        if (category === "Human") {
            detectedEntity = "A person is detected.";
        } else if (category === "Object") {
            detectedEntity = `This image contains objects: ${labels.slice(0, 5).join(", ")}.`;
        } else if (animalType) {
            detectedEntity = `This is a ${animalType}.`;
        } else if (category === "Animal") {
            detectedEntity = `This is an animal. Possibly: ${labels.slice(0, 3).join(", ")}.`;
        }

        // Extract face details if a person is detected
        let faceDetails = "No face detected.";
        let expressions = [];

        if (result.faceAnnotations && result.faceAnnotations.length > 0) {
            const face = result.faceAnnotations[0];

            // Detect emotions
            if (["LIKELY", "VERY_LIKELY"].includes(face.joyLikelihood)) expressions.push("smiling");
            if (["LIKELY", "VERY_LIKELY"].includes(face.sorrowLikelihood)) expressions.push("sad");
            if (["LIKELY", "VERY_LIKELY"].includes(face.surpriseLikelihood)) expressions.push("surprised");

            faceDetails = expressions.length > 0 ? `Person detected with expression: ${expressions.join(", ")}.` : "Person detected.";
        }

        res.json({ 
            category, 
            detectedEntity, 
            faceDetails, 
            labels,
            mainObject: mainObject || "Unknown"
        });
    } catch (error) {
        console.error("Vision API Error:", error);
        res.status(500).json({ error: "Error processing image" });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));