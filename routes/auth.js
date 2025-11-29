const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  register,
  registerStudent,
  registerAdmin,
  login,
  getMe,
  logout
} = require('../controllers/authController');

// Public routes
router.post('/register', register);
router.post('/register/student', registerStudent);
router.post('/register/admin', registerAdmin);
router.post('/login', login);

// Protected routes
router.get('/me', protect, getMe);
router.get('/logout', protect, logout);

module.exports = router;
