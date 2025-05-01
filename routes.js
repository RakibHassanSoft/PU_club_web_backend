const express = require('express');
const router = express.Router();

// Import individual route files
const authRoutes = require('./User/authRoutes');

// Use them with a base path
router.use('/auth', authRoutes);

// You can add more in future like:
// const userRoutes = require('./userRoutes');
// router.use('/users', userRoutes);

module.exports = router;
