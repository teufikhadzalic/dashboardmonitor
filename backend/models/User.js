const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);