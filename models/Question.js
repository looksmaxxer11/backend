import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String, required: true }],
  correctAnswer: { type: String, required: true },

});

// Add a pre-save middleware to validate answer
questionSchema.pre('save', function(next) {
  if (!this.correctAnswer) {
    next(new Error('Question must have an answer'));
  }
  if (!this.options.includes(this.correctAnswer)) {
    next(new Error('Answer must be one of the options'));
  }
  next();
});

const Question = mongoose.model("Question", questionSchema);
export default Question;
