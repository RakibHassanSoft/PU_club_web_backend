const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  puId: { type: String, required: true, unique: true },
  codeforcesHandle: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  isDeleteD: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  isAdmin: { type: Boolean, default: false },
  password: { type: String, required: true }
});

// ✅ Pre-save middleware to hash password
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// ✅ Instance method to compare password
userSchema.methods.comparePassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

//Static method to check uniqueness
userSchema.statics.isUserExists = async function ({ puId, email, codeforcesHandle }) {
  const existingUser = await this.findOne({
    $or: [
      { puId },
      { email },
      { codeforcesHandle }
    ]
  });
  return !!existingUser;
};

module.exports = mongoose.model('User', userSchema);
