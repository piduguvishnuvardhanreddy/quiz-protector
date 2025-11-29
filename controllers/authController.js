const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { generateToken, sendTokenResponse } = require('../utils/authUtils');
const asyncHandler = require('../middleware/async');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ErrorResponse('User already exists', 400);
  }

  // Validate role
  const requestedRole = role || 'student';
  if (!['student', 'admin'].includes(requestedRole)) {
    throw new ErrorResponse('Invalid role', 400);
  }

  // Admin registration guard: require code if configured, or allow first admin
  if (requestedRole === 'admin') {
    const codeRequired = !!process.env.ADMIN_SIGNUP_CODE;
    if (codeRequired) {
      const { adminCode } = req.body || {};
      if (!adminCode || adminCode !== process.env.ADMIN_SIGNUP_CODE) {
        throw new ErrorResponse('Invalid or missing admin access code', 403);
      }
    } else {
      // If no code configured, only allow creating the first admin
      const adminExists = await User.exists({ role: 'admin' });
      if (adminExists) {
        throw new ErrorResponse('Admin creation is restricted. Set ADMIN_SIGNUP_CODE in environment.', 403);
      }
    }
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role: requestedRole
  });

  // Send token response
  sendTokenResponse(user, 201, res);
});

// @desc    Register student
// @route   POST /api/auth/register/student
// @access  Public
exports.registerStudent = asyncHandler(async (req, res, next) => {
  req.body.role = 'student';
  // Reuse the same logic as register by invoking the core flow explicitly
  const { name, email, password } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ErrorResponse('User already exists', 400);

  const user = await User.create({ name, email, password, role: 'student' });
  sendTokenResponse(user, 201, res);
});

// @desc    Register admin (requires ADMIN_SIGNUP_CODE or be the first admin)
// @route   POST /api/auth/register/admin
// @access  Public (guarded by code/first-admin rule)
exports.registerAdmin = asyncHandler(async (req, res, next) => {
  req.body.role = 'admin';
  const { name, email, password, adminCode } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) throw new ErrorResponse('User already exists', 400);

  const codeRequired = !!process.env.ADMIN_SIGNUP_CODE;
  if (codeRequired) {
    if (!adminCode || adminCode !== process.env.ADMIN_SIGNUP_CODE) {
      throw new ErrorResponse('Invalid or missing admin access code', 403);
    }
  } else {
    const adminExists = await User.exists({ role: 'admin' });
    if (adminExists) {
      throw new ErrorResponse('Admin creation is restricted. Set ADMIN_SIGNUP_CODE in environment.', 403);
    }
  }

  const user = await User.create({ name, email, password, role: 'admin' });
  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new ErrorResponse('Please provide an email and password', 400);
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    throw new ErrorResponse('Invalid credentials', 401);
  }

  const isMatch = await user.matchPassword(password);
  if (!isMatch) {
    throw new ErrorResponse('Invalid credentials', 401);
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  res.status(200).json({ success: true, data: user });
});

// @desc    Log user out / clear cookie
// @route   GET /api/auth/logout
// @access  Private
exports.logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });

  res.status(200).json({
    success: true,
    data: {}
  });
};
