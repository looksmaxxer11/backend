import mongoose from "mongoose";
import jwt from "jsonwebtoken";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    resetToken: String,
    resetTokenExpiry: Date,
    // Add user quiz preferences and history
    quizPreferences: {
      difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
      categoryWeights: {
        part1: { type: Number, default: 1 },
        part2: { type: Number, default: 1 },
        part3: { type: Number, default: 1 },
        part4: { type: Number, default: 1 },
        part5: { type: Number, default: 1 },
        part6: { type: Number, default: 1 }
      },
      lastAttemptedCategories: [String] // Track recently attempted categories
    },
    questionHistory: [{
      questionId: mongoose.Schema.Types.ObjectId,
      category: String,
      attempts: Number,
      correctAttempts: Number,
      lastAttempted: Date
    }],
    currentQuiz: {
      questions: [{
        questionId: mongoose.Schema.Types.ObjectId,
        question: String,
        options: [String],
        correctAnswer: String,
        category: String
      }],
      startTime: Date,
      currentQuestionIndex: Number,
      userAnswers: mongoose.Schema.Types.Mixed,
      remainingTime: Number,
      lastUpdated: Date
    },
    quizResults: {
      type: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Result'
      }],
      default: [] // Initialize as empty array
    }
  },
  { timestamps: true }
);

// Add middleware to check quiz expiration and update question history
userSchema.pre('save', function(next) {
  if (this.currentQuiz && this.currentQuiz.startTime) {
    const quizAge = Date.now() - this.currentQuiz.startTime.getTime();
    if (quizAge > 50 * 60 * 1000) { // 50 minutes
      this.currentQuiz = null;
    }
  }
  next();
});

// Add method to update question history
userSchema.methods.updateQuestionHistory = function(questionId, category, isCorrect) {
  const historyEntry = this.questionHistory.find(h => h.questionId.equals(questionId));
  
  if (historyEntry) {
    historyEntry.attempts += 1;
    if (isCorrect) historyEntry.correctAttempts += 1;
    historyEntry.lastAttempted = new Date();
  } else {
    this.questionHistory.push({
      questionId,
      category,
      attempts: 1,
      correctAttempts: isCorrect ? 1 : 0,
      lastAttempted: new Date()
    });
  }
};

// Add method to get performance analytics
userSchema.methods.getPerformanceAnalytics = function() {
  const analytics = {
    byCategory: {},
    overall: {
      totalAttempts: 0,
      correctAttempts: 0
    }
  };

  this.questionHistory.forEach(history => {
    if (!analytics.byCategory[history.category]) {
      analytics.byCategory[history.category] = {
        attempts: 0,
        correct: 0
      };
    }
    
    analytics.byCategory[history.category].attempts += history.attempts;
    analytics.byCategory[history.category].correct += history.correctAttempts;
    analytics.overall.totalAttempts += history.attempts;
    analytics.overall.correctAttempts += history.correctAttempts;
  });

  return analytics;
};

// Add these methods to the userSchema
userSchema.methods.clearQuizState = function() {
  this.currentQuiz = null;
  return this.save();
};

userSchema.methods.startNewQuiz = function(questions) {
  this.currentQuiz = {
    questions: questions.map(q => ({
      questionId: q._id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      category: q.category
    })),
    currentQuestionIndex: 0,
    remainingTime: 3000,
    startTime: new Date(),
    lastUpdated: new Date(),
    isActive: true
  };
  return this.save();
};

// Add this static method
userSchema.statics.findByToken = async function(token) {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return this.findById(decoded.id);
  } catch (error) {
    return null;
  }
};

const User = mongoose.model("User", userSchema);
export default User;
