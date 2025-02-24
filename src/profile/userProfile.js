import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import { ProfileModel } from "../../models/ProfileModel.js";


const router = express.Router();
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error(
    "FATAL ERROR: MONGODB_URI is not defined in environment variables"
  );
  process.exit(1);
}

  router.use(cors());
router.use(express.json());

const USERS_DB_URI = MONGODB_URI.replace(/\/[^\/]+$/, "/law-quiz");

// mongoose
//   .connect(USERS_DB_URI)
//   .then(() => console.log("✅ Connected to the users database"))
//   .catch((err) => console.error("❌ MongoDB connection error:", err));

const ObjectId = mongoose.Types.ObjectId;

router.get("/api/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const user = await ProfileModel.findById(new ObjectId(userId));

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user:", error); // Log detailed error
    res.status(500).json({ message: "Server error.", error: error.message }); // Return the error message
  }
});


// Add this to your backend file
router.put("/api/user/:id", async (req, res) => {
  try {
    const userId = req.params.id;
    const updateData = req.body;

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID format" });
    }

    const updatedUser = await ProfileModel.findByIdAndUpdate(
      new ObjectId(userId),
      updateData,
      { new: true } // This option returns the updated document
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found!" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error.", error: error.message });
  }
});




router.post("/api/user/change-email", async (req, res) => {
  try {
    const { userId, currentPassword, newEmail } = req.body;

    // 1. Verify current password
    const user = await ProfileModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2. Check if password matches (using your password verification method)
    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password
    );
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // 3. Check if new email is already in use
    const existingUser = await ProfileModel.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use" });
    }

    // 4. Generate verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");

    // 5. Save pending email change
    user.pendingEmail = newEmail;
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
    await user.save();

    // 6. Send verification email
    // ... implement your email sending logic here

    res.json({ message: "Verification email sent" });
  } catch (error) {
    console.error("Email change error:", error);
    res.status(500).json({ message: "Server error" });
  }
});



export default router;
