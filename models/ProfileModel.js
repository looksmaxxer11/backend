import mongoose from "mongoose";
                                                                    
const profileSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    surname: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    avatarUrl: { type: String, default: null },
    stats: {
      solvedQuestions: { type: Number, default: 0 },
      totalPoints: { type: Number, default: 0 },
      ranking: { type: Number, default: 0 },
    },
    authToken: { type: String, select: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    collection: "users",
  }
);

profileSchema.index({ email: 1 });
profileSchema.index({ name: 1 });
profileSchema.index({ surname: 1 });

export const ProfileModel = mongoose.model("Profile", profileSchema);
