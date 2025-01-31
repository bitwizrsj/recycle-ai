const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config(); // Load environment variables from .env

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.VITE_GOOGLE_API_KEY; // Get the real API key from .env
const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`;

app.post("/api/gemini", async (req, res) => {
    try {
        // Ensure the request body is formatted properly
        const requestData = {
            contents: req.body.contents,
        };

        const response = await axios.post(API_URL, requestData, {
            headers: {
                "Content-Type": "application/json",
            },
        });

        res.json(response.data);
    } catch (error) {
        console.error("Error calling Gemini API:", error.response?.data || error.message);
        res.status(500).json({ error: error.response?.data || "Internal Server Error" });
    }
});

app.listen(5000, () => {
    console.log("Server running on port 5000");
});
