import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";

dotenv.config();

// Debug: Check environment variables
console.log("MONGODB_URI:", process.env.MONGODB_URI);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

// Collections Array
const collections = [
  "questions_part1",
  "questions_part2",
  "questions_part3",
  "questions_part4",
  "questions_part5",
  "questions_part6",
];

// Utility Function to Fetch All Questions
const fetchAllQuestions = async () => {
  const allQuestions = [];
  const db = mongoose.connection.db;

  for (const collectionName of collections) {
    try {
      const collection = db.collection(collectionName);
      const questions = await collection.find({}).toArray();
      allQuestions.push(...questions);
    } catch (err) {
      console.error(
        `Error fetching from collection: ${collectionName}`,
        err.message
      );
    }
  }

  return allQuestions;
};

// Get a Random Question
app.get("/api/question", async (req, res) => {
  try {
    const allQuestions = await fetchAllQuestions();

    if (allQuestions.length === 0) {
      return res.status(404).json({ message: "No questions available" });
    }

    const randomQuestion =
      allQuestions[Math.floor(Math.random() * allQuestions.length)];
    res.json(randomQuestion);
  } catch (error) {
    console.error("Error fetching random question:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

// Get Multiple Random Questions
app.get("/api/questions", async (req, res) => {
  const numberOfQuestions = parseInt(req.query.count) || 5; // Default to 5 questions
  try {
    const allQuestions = await fetchAllQuestions();

    if (allQuestions.length === 0) {
      return res.status(404).json({ message: "No questions available" });
    }

    const randomQuestions = [];
    const questionPool = [...allQuestions]; // Copy to avoid mutating original array

    for (let i = 0; i < numberOfQuestions && questionPool.length > 0; i++) {
      const randomIndex = Math.floor(Math.random() * questionPool.length);
      randomQuestions.push(questionPool[randomIndex]);
      questionPool.splice(randomIndex, 1); // Remove to avoid duplicates
    }

    res.json(randomQuestions);
  } catch (error) {
    console.error("Error fetching multiple questions:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

// Define the Result Schema
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

// Save Quiz Results
app.post("/api/results", async (req, res) => {
  const { user, score, totalQuestions } = req.body;

  if (!user || score === undefined || totalQuestions === undefined) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const result = new Result({
    user,
    score,
    totalQuestions,
  });

  try {
    await result.save();
    res.status(201).json({ message: "Result saved successfully" });
  } catch (error) {
    console.error("Error saving quiz result:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

// Fetch Quiz Results
app.get("/api/results", async (req, res) => {
  try {
    const results = await Result.find().sort({ date: -1 });
    res.json(results);
  } catch (error) {
    console.error("Error fetching quiz results:", error.message);
    res.status(500).send("Internal Server Error");
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
