import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Explicitly load .env
dotenv.config({ path: join(__dirname, ".env") });

console.log("✅ MONGODB_URI:", process.env.MONGODB_URI || "❌ NOT LOADED");

if (!process.env.MONGODB_URI) {
  throw new Error("❌ MONGODB_URI is not defined in .env file");
}

import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import authService from "./src/authentication/auth.mjs";
import profileService from "./src/profile/userProfile.js";
import mainService from "./src/index.mjs";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.use("/auth", authService);
app.use("/", profileService);
app.use("/", mainService);

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
