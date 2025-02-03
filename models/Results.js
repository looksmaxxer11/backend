import mongoose from "mongoose";

// Define the Result Schema with backward compatibility
const resultSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  duration: {
    type: Number,
    default: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  questions: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    question: {
      type: String,
      required: true
    },
    options: [String],
    userAnswer: {
      type: String,
      required: true,
      validate: {
        validator: function(v) {
          return /^[A-D]$/.test(v); // Assuming answers are A, B, C, or D
        },
        message: props => `${props.value} is not a valid answer option!`
      }
    },
    correctAnswer: {
      type: String,
      required: true
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }]
});

// Virtual property to calculate percentage
resultSchema.virtual("percentage").get(function () {
  return ((this.score / this.totalQuestions) * 100).toFixed(1);
});

// Ensure indexes for better query performance
resultSchema.index({ user: 1, date: -1 });

// Pre-save middleware to ensure backwards compatibility
resultSchema.pre("save", function (next) {
  // If questions array is provided but duration isn't, calculate a default duration
  if (this.questions && this.questions.length > 0 && !this.duration) {
    this.duration = 50; // Default duration from your existing code
  }
  next();
});

// Export the Result model
const Result = mongoose.model("Result", resultSchema);
export default Result;
