import mongoose from "mongoose";

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

export default Result;
