require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const cors = require('cors');
// Use central router
const routes = require('./routes');
const app = express();

// CORS configuration
const corsOptions = {
    origin: '*', // Allow frontend origin
    methods: ['GET', 'POST', 'PUT', 'DELETE','PATCH'], // Allowed HTTP methods
    credentials: true, // Allow cookies to be sent
  };

// Middleware
app.use(cors(corsOptions)); // Apply CORS middleware
app.use(express.json());
app.use(cookieParser());

// Connect DB
connectDB();

// Routes
app.use('/api/v1', routes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));



//