import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import cors from "cors";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../../models/User.js";

const router = express.Router();

router.use(cors());
router.use(express.json());

const sendEmail = async (to, subject, text) => {
   const transporter = nodemailer.createTransport({
     service: "gmail",
     host: "smtp.gmail.com",
     port: 587,
     secure: false,
     auth: {
       user: process.env.EMAIL_USER, // This will be defined in your .env file
       pass: process.env.EMAIL_PASS,  // This will be defined in your .env file
     },
   });

   const mailOptions = {
     from: process.env.EMAIL_USER, // Email comes FROM your service email
     to: to,
     subject,
     text,
  };
  
  await transporter.sendMail(mailOptions);
};

router.post("/signup", async (req, res) => {
  const { name, surname, email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "User already exists! Use a different email!" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      surname,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ message: "User registered successfully!", token });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
});

router.post("/resetpassword", async (req, res) => {
  const { email } = req.body;
  console.log("Received reset password request for email:", email);

  try {
    const existingUser = await User.findOne({
      email: new RegExp(`^${email}$`, "i"),
    });

    console.log("User search result:", existingUser ? "Found" : "Not found");

    if (!existingUser) {
      return res.status(400).json({
        message:
          "No account found with this email address. Please check and try again.",
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = Date.now() + 3600000;

    existingUser.resetToken = resetToken;
    existingUser.resetTokenExpiry = resetTokenExpiry;
    await existingUser.save();

    const resetLink = `http://localhost:3000/reset-password/${resetToken}`;

    await sendEmail(
      existingUser.email,
      "Password Reset",
      `Reset your password here: ${resetLink}`
    );

    res.status(200).json({ message: "Password reset email sent!" });
  } catch (error) {
    console.error("Detailed reset password error:", error);
    res.status(500).json({
      message: "Server error. Please try again later.",
      error: error.message,
    });
  }
});

router.post("/resetpassword/confirm", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      console.log("Invalid token or token expired"); // Debug log
      return res.status(400).send("Invalid token or token expired.");
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    res.status(200).send("Password has been reset successfully.");
  } catch (error) {
    console.error("Error resetting password:", error); // Detailed error log
    res.status(500).send("Failed to reset password. Please try again.");
  }
});

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Authentication token required" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("Token verification failed:", error);
    return res.status(403).json({ error: "Invalid or expired token" });
  }
};

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const existingUser = await User.findOne({ email })
      .select("+password") // Explicitly include password
      .lean(); // Convert to plain JavaScript object

    if (!existingUser) {
      return res.status(400).json({ message: "User not found!" });
    }

    const isMatch = await bcrypt.compare(password, existingUser.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password!" });
    }

    // Clear any existing quiz state
    await User.findByIdAndUpdate(existingUser._id, {
      $set: { currentQuiz: null },
    });

    const token = jwt.sign(
      {
        id: existingUser._id,
        email: existingUser.email,
      },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    return res.status(200).json({
      message: "Login successful!",
      token,
      user: {
        id: existingUser._id,
        name: existingUser.name,
        email: existingUser.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong. Please try again." });
  }
});

router.post("/logout", authenticateToken, async (req, res) => {
  try {
    // Clear the current quiz state
    await User.findByIdAndUpdate(req.user.id, {
      $set: { currentQuiz: null },
    });

    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Failed to logout" });
  }
});

// PROFILE ID
router.get("/api/user/:id", async (req, res) => {
  try {
    console.log("Connecting to MongoDB...");

    const user = await User.findById(req.params.id); // Use req.params.id to fetch the user
    console.log("User fetched:", user);

    if (!user) {
      console.log("User not found!");
      return res.status(404).json({ message: "User not found!" });
    }

    console.log("Returning user:", user);
    res.status(200).json(user); // Return user data
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Server error." });
  }
});

export default router;
