import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: String,
  options: [String], // Change options to an array of strings
  answer: String, // Ensure this matches your document structure
});

const Question = mongoose.model("Question", questionSchema);

export default Question;
