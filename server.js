const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const quizRoutes = require('./routes/quiz');
const attemptRoutes = require('./routes/attempt');

// Initialize express app
const app = express();

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  // If FRONTEND_URL not set, reflect request origin for dev
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/attempts', attemptRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware (preserve explicit status codes)
app.use((err, req, res, next) => {
  // Log the full error stack for debugging
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode,
    name: err.name
  });

  // Normalize common Mongoose errors
  if (err && err.name === 'ValidationError') {
    err.statusCode = err.statusCode || 400;
    err.message = Object.values(err.errors).map((e) => e.message).join(', ');
  }
  if (err && err.code === 11000) {
    err.statusCode = 400;
    const fields = Object.keys(err.keyValue || {});
    err.message = `Duplicate value for field(s): ${fields.join(', ')}`;
  }

  const status = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;
