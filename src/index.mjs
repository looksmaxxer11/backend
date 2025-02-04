import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import jwt from "jsonwebtoken";
import Question from "../models/Question.js";
import User from "../models/User.js";
import Result from "../models/Results.js";

const router = express.Router();

router.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3001'], // Add your frontend URLs
  credentials: true
}));
router.use(express.json());

// Define authenticateToken middleware first
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    console.log("No token provided");
    return res.status(401).json({ error: "Authentication token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token decoded for user:", decoded.id);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ error: "Invalid token" });
  }
};

// Add this before your routes
router.use(authenticateToken, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user && user.currentQuiz) {
      const quizAge = Date.now() - new Date(user.currentQuiz.startTime).getTime();
      if (quizAge > 50 * 60 * 1000) { // 50 minutes in milliseconds
        console.log('Clearing expired quiz for user:', req.user.id);
        user.currentQuiz = null;
        await user.save();
      }
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Add at the top with other constants
const TIME_LIMIT = 50; // 50 minutes
const TOTAL_QUESTIONS = 50; // Total number of questions in quiz
 // Adjust based on how many questions you want from each part
const COLLECTIONS = [
  'questions_part1',
  'questions_part2',
  'questions_part3',
  'questions_part4',
  'questions_part5',
  'questions_part6'
];

const QUESTIONS_PER_PART = Math.ceil(50 / COLLECTIONS.length);

// MongoDB Connection with debug logging
console.log("📡 Connecting to MongoDB...");
// mongoose
//   .connect(process.env.MONGODB_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//     serverSelectionTimeoutMS: 10000, // 10 second timeout
//     heartbeatFrequencyMS: 2000, // More frequent heartbeats
//   })
//   .then(() => {
//     console.log("✅ Connected to MongoDB successfully");
//   })
//   .catch((err) => {
//     console.error("❌ MongoDB connection error:", err);
//     if (err.name === "MongoNetworkError") {
//       console.error("Network error details:", {
//         code: err.code,
//         syscall: err.syscall,
//         hostname: err.hostname,
//       });
//     }
//     process.exit(1);
//   });

// Monitor MongoDB connection
mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("MongoDB disconnected");
});

mongoose.connection.on("reconnected", () => {
  console.log("MongoDB reconnected");
});

// Health check endpoint
router.get("/api/health", (req, res) => {
  const dbStatus =
    mongoose.connection.readyState === 1 ? "connected" : "disconnected";
  res.json({
    status: "ok",
    database: dbStatus,
    timestamp: new Date().toISOString(),
  });
});

// Simplified questions endpoint
router.get('/api/questions', authenticateToken, async (req, res) => {
  try {
    const questions = await Question.aggregate([{ $sample: { size: 50 } }]); // Fetch 50 random questions

    if (questions.length === 0) {
      return res.status(500).json({ error: "No questions available" });
    }

    res.json({
      questions,
      remainingTime: 3000,
      currentQuestionIndex: 0
    });
  } catch (error) {
    console.error("Database error:", error);
    res.status(500).json({ 
      error: "Failed to fetch questions",
      details: error.message 
    });
  }
});

router.get("/api/results", authenticateToken, async (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get page number from query, default to 1
  const limit = parseInt(req.query.limit) || 10; // Get limit from query, default to 10
  const skip = (page - 1) * limit; // Calculate how many results to skip

  try {
    console.log("Fetching results for user:", req.user.id);
    const results = await Result.find({ user: req.user.id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .exec();

    const totalCount = await Result.countDocuments({ user: req.user.id }); // Get total count of results

    console.log("Found results:", results.length);
    res.set('x-total-count', totalCount); // Set total count in response headers
    res.json(results);
  } catch (error) {
    console.error("Error fetching results:", error);
    res.status(500).json({ error: "Failed to fetch results" });
  }
});

router.post("/api/quiz/save-state", authenticateToken, async (req, res) => {
  try {
    console.log("Saving state for user:", req.user.id);
    console.log("Received state data:", req.body);
    
    const user = await User.findById(req.user.id);
    if (!user || !user.currentQuiz) {
      return res.status(404).json({ error: "No active quiz found" });
    }

    const { currentQuestionIndex, userAnswers, remainingTime } = req.body;

    // Update quiz state with validation
    const updatedQuizState = {
      ...user.currentQuiz,
      currentQuestionIndex: currentQuestionIndex || 0,
      userAnswers: userAnswers || {},
      remainingTime: remainingTime || 3000,
      lastUpdated: new Date()
    };

    // Use findByIdAndUpdate to avoid validation issues
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { currentQuiz: updatedQuizState } },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      throw new Error("Failed to update user quiz state");
    }

    console.log("Successfully saved state for user:", req.user.id);
    res.json({ message: "Quiz state saved successfully" });
    
  } catch (error) {
    console.error("Error saving quiz state:", error);
    res.status(500).json({ 
      error: "Failed to save quiz state",
      details: error.message 
    });
  }
});


// const questions = [
//   {
//     question: "What is the capital of France?",
//     options: ["Paris", "London", "Berlin", "Madrid"],
//     correctAnswer: "Paris",
//   },
//   {
//     question: "What is 2 + 2?",
//     options: ["3", "4", "5", "6"],
//     correctAnswer: "4",
//   },
//   // Add more questions as needed
// ];
// Results endpoint
router.post("/api/results", authenticateToken, async (req, res) => {
  try {
    console.log("Saving results for user:", req.user.id);
    console.log("Raw request body:", req.body); // Log the raw request body

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const { questions, totalQuestions, duration } = req.body;
    console.log("Received questions:", questions); // Log the questions array

    // Validate request body structure
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        error: "Invalid quiz data",
        details: "Questions field is required and must be a non-empty array"
      });
    }

    // Process questions and calculate score
    const processedQuestions = questions.map(q => {
      console.log("Processing question:", q); // Log each question
      const userAnswer = q.userAnswer || "";
      const isCorrect = userAnswer === q.correctAnswer;

      return {
        questionId: new mongoose.Types.ObjectId(q.questionId),
        question: q.question,
        options: q.options,
        userAnswer: userAnswer,
        correctAnswer: q.correctAnswer,
        isCorrect: isCorrect
      };
    });

    const score = processedQuestions.filter(q => q.isCorrect).length;

    // Create new result document
    const result = new Result({
      user: user._id,
      score: score,
      totalQuestions: totalQuestions || questions.length,
      duration: duration || 50, // Default duration if not provided
      questions: processedQuestions,
      date: new Date()
    });

    console.log("Attempting to save result:", result); // Log the result object

    await result.save();

    // Clear the current quiz
    user.currentQuiz = null;
    await user.save();

    console.log("Successfully saved results for user:", req.user.id);
    res.json(result);

  } catch (error) {
    console.error("Error saving results:", error);
    res.status(500).json({
      error: "Failed to save results",
      details: error.message,
      // stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get specific quiz result
router.get("/api/results/:id", authenticateToken, async (req, res) => {
  try {
    const result = await Result.findOne({
      _id: req.params.id,
      user: req.user.id
    });

    if (!result) {
      return res.status(404).json({ error: "Result not found" });
    }

    res.json(result);
  } catch (error) {
    console.error("Error fetching result:", error);
    res.status(500).json({ error: "Failed to fetch result" });
  }
});

// Modify the sync endpoint to prevent question changes
router.post("/api/quiz/sync", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentQuestionIndex, userAnswers } = req.body;

    const user = await User.findById(userId);
    if (!user || !user.currentQuiz) {
      return res.status(404).json({ error: "No active quiz found" });
    }

    // Check if quiz has expired
    const quizAge = Date.now() - new Date(user.currentQuiz.startTime).getTime();
    const remainingTime = Math.max(0, (TIME_LIMIT * 60 * 1000) - quizAge);

    if (remainingTime <= 0) {
      // Auto-submit expired quiz
      user.currentQuiz = null;
      await user.save();
      return res.status(400).json({ 
        error: "Quiz expired",
        message: "Your quiz has expired and will be auto-submitted."
      });
    }

    // Validate question index
    if (currentQuestionIndex < 0 || currentQuestionIndex >= TOTAL_QUESTIONS) {
      return res.status(400).json({ error: "Invalid question index" });
    }

    // Update quiz state
    user.currentQuiz.currentQuestionIndex = currentQuestionIndex;
    user.currentQuiz.userAnswers = userAnswers;
    user.currentQuiz.lastUpdated = new Date();
    await user.save();

    res.json({
      remainingTime: Math.floor(remainingTime / 1000),
      currentQuestionIndex: user.currentQuiz.currentQuestionIndex,
      userAnswers: user.currentQuiz.userAnswers
    });
  } catch (error) {
    console.error("Error syncing quiz state:", error);
    res.status(500).json({ error: "Failed to sync quiz state" });
  }
});

// Get current quiz state
router.get("/api/quiz/current", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);

    if (!user || !user.currentQuiz) {
      return res.status(404).json({ error: "No active quiz found" });
    }

    // Safe check for startTime
    const startTime = user.currentQuiz.startTime || new Date();
    const quizAge = Date.now() - startTime.getTime();
    
    if (quizAge > TIME_LIMIT * 60 * 1000) { // 50 minutes in milliseconds
      user.currentQuiz.isActive = false;
      await user.save();
      return res.status(404).json({ error: "Quiz has expired" });
    }

    // If quiz exists and hasn't expired, send back the state
    const quizState = {
      questions: user.currentQuiz.questions,
      currentQuestionIndex: user.currentQuiz.currentQuestionIndex || 0,
      remainingTime: user.currentQuiz.remainingTime || TIME_LIMIT * 60,
      startTime: startTime,
      isActive: true,
      userAnswers: Object.fromEntries(
        (user.currentQuiz.questions || [])
          .filter(q => q.userAnswer)
          .map(q => [q.questionId, q.userAnswer])
      )
    };

    res.json(quizState);
  } catch (error) {
    console.error("Error fetching quiz state:", error);
    res.status(500).json({ 
      error: "Failed to fetch quiz state",
      details: error.message 
    });
  }
});

// Get quiz state endpoint
router.get("/api/quiz/state", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.currentQuiz) {
      return res.status(404).json({ error: "No active quiz found" });
    }

    res.json({
      questions: user.currentQuiz.questions,
      currentQuestionIndex: user.currentQuiz.currentQuestionIndex || 0,
      userAnswers: user.currentQuiz.userAnswers || {},
      remainingTime: user.currentQuiz.remainingTime || 3000,
      startTime: user.currentQuiz.startTime
    });
  } catch (error) {
    console.error("Error fetching quiz state:", error);
    res.status(500).json({ error: "Failed to fetch quiz state" });
  }
});

// Clear quiz state endpoint
router.delete("/api/quiz/state", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.currentQuiz = null;
      await user.save();
    }
    res.status(200).json({ message: "Quiz state cleared" });
  } catch (error) {
    console.error("Error clearing quiz state:", error);
    res.status(500).json({ error: "Failed to clear quiz state" });
  }
});

// Add this middleware to clear quiz state on logout
router.post("/api/logout", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (user) {
      user.currentQuiz = null;
      await user.save();
    }
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Failed to logout" });
  }
});

// Start quiz endpoint
router.post("/api/quiz/start", authenticateToken, async (req, res) => {
  try {
    console.log("Starting quiz for user:", req.user.id);
    
    let allQuestions = [];

    // Fetch questions from each collection
    for (const collection of COLLECTIONS) {
      try {
        const questions = await mongoose.connection.collection(collection)
          .aggregate([
            { $sample: { size: QUESTIONS_PER_PART + 2 } } // Fetch a few extra questions
          ]).toArray();
        
        // Map the answer field to correctAnswer
        const questionsWithCorrectAnswer = questions.map(q => ({
          _id: q._id.toString(),
          question: q.question,
          options: q.options,
          correctAnswer: q.answer // Map the answer field to correctAnswer
        }));
        
        allQuestions = [...allQuestions, ...questionsWithCorrectAnswer];
      } catch (error) {
        console.error(`Error fetching from ${collection}:`, error);
      }
    }

    // Check if we have enough questions
    if (allQuestions.length < 50) {
      console.log("Not enough questions available in the database");
      return res.status(500).json({ error: "Not enough questions available" });
    }

    // Shuffle and select 50 questions
    allQuestions = allQuestions.sort(() => 0.5 - Math.random()).slice(0, 50);

    console.log(`Fetched ${allQuestions.length} questions total`);

    // Create new quiz state
    const newQuizState = {
      questions: allQuestions,
      startTime: new Date(),
      currentQuestionIndex: 0,
      userAnswers: {},
      remainingTime: 3000,
      lastUpdated: new Date()
    };

    // Update user document with new quiz state
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { currentQuiz: newQuizState } },
      { new: true, runValidators: false }
    );

    if (!updatedUser) {
      throw new Error("Failed to update user with new quiz state");
    }

    console.log("Quiz started successfully for user:", req.user.id);
    res.json({ quizState: newQuizState });

  } catch (error) {
    console.error("Error starting quiz:", error);
    res.status(500).json({ 
      error: "Failed to start quiz",
      details: error.message,
      // stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Save quiz state endpoint
router.post("/api/quiz/save-state", authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.currentQuiz) {
      return res.status(404).json({ error: "No active quiz found" });
    }

    const { currentQuestionIndex, userAnswers, remainingTime } = req.body;

    // Update quiz state
    user.currentQuiz.currentQuestionIndex = currentQuestionIndex;
    user.currentQuiz.userAnswers = userAnswers;
    user.currentQuiz.remainingTime = remainingTime;
    user.currentQuiz.lastUpdated = new Date();

    await user.save();
    res.json({ message: "Quiz state saved successfully" });
  } catch (error) {
    console.error("Error saving quiz state:", error);
    res.status(500).json({ error: "Failed to save quiz state" });
  }
});

// Helper function to determine the part number from collection name or ObjectId
function getPartFromCollectionName(objectId) {
  // You might want to implement logic here to determine the part
  // based on which collection the question came from
  return 'part1'; // Default value
}

// Update quiz state endpoint
router.post("/api/quiz/update-state", authenticateToken, async (req, res) => {
  try {
    const { currentQuestionIndex, userAnswers, remainingTime } = req.body;
    
    const user = await User.findById(req.user.id);
    if (!user || !user.currentQuiz) {
      return res.status(404).json({ error: "No active quiz found" });
    }

    // Update quiz state
    user.currentQuiz.currentQuestionIndex = currentQuestionIndex;
    user.currentQuiz.userAnswers = new Map(Object.entries(userAnswers));
    user.currentQuiz.remainingTime = remainingTime;
    user.currentQuiz.lastUpdated = new Date();

    await user.save();

    res.json({
      message: "Quiz state updated",
      currentQuestionIndex,
      remainingTime
    });

  } catch (error) {
    console.error("Error updating quiz state:", error);
    res.status(500).json({ error: "Failed to update quiz state" });
  }
});

// Start server
// router.listen(PORT, () => {
//   console.log(`🚀 Server (Index.mjs) running on http://localhost:${PORT}`);
//   console.log("📝 API endpoints:");
//   console.log("- GET  /api/health");
//   console.log("- POST /api/quiz/start");
//   console.log("- POST /api/quiz/update-state");
//   console.log("- POST /api/results");
// });
export default router;