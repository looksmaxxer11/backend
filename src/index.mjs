import dotenv from "dotenv";
dotenv.config();
console.log("MONGODB_URI:", process.env.MONGODB_URI); // Debug statement

import express from "express";
import mongoose from "mongoose";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB Atlas");
  })
  .catch((error) => {
    console.log("MongoDB connection error:", error.message);
  });

const fetchAllQuestions = async () => {
  const db = mongoose.connection.db;
  const collection = db.collection("questions_part1"); // Fetch from a single collection for testing

  console.log("Fetching data from questions_part1...");

  const questions = await collection.find({}).toArray();

  console.log(`Fetched ${questions.length} questions from questions_part1`);

  return questions;
};

// Get a random question
app.get("/api/question", async (req, res) => {
  try {
    const allQuestions = await fetchAllQuestions();
    const randomQuestion =
      allQuestions[Math.floor(Math.random() * allQuestions.length)];
    res.json(randomQuestion);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Get multiple random questions
app.get("/api/questions", async (req, res) => {
  const numberOfQuestions = parseInt(req.query.count) || 5; // Default to 5 questions if not specified
  try {
    const allQuestions = await fetchAllQuestions();
    const randomQuestions = [];

    for (let i = 0; i < numberOfQuestions; i++) {
      const randomIndex = Math.floor(Math.random() * allQuestions.length);
      randomQuestions.push(allQuestions[randomIndex]);
      allQuestions.splice(randomIndex, 1); // Remove the selected question to avoid duplicates
    }

    res.json(randomQuestions);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Define the result schema
const resultSchema = new mongoose.Schema({
  user: String, // You can replace this with actual user identification
  score: Number,
  totalQuestions: Number,
  date: {
    type: Date,
    default: Date.now,
  },
});

const Result = mongoose.model("Result", resultSchema);

// Save quiz results
app.post("/api/results", async (req, res) => {
  const { user, score, totalQuestions } = req.body;

  const result = new Result({
    user,
    score,
    totalQuestions,
  });

  try {
    await result.save();
    res.status(201).send("Result saved successfully");
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Fetch quiz results
app.get("/api/results", async (req, res) => {
  try {
    const results = await Result.find().sort({ date: -1 });
    res.json(results);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
