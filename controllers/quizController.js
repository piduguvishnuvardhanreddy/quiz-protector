const Quiz = require('../models/Quiz');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Create a new quiz
// @route   POST /api/quizzes
// @access  Private/Admin
exports.createQuiz = asyncHandler(async (req, res, next) => {
  console.log('createQuiz called, next type:', typeof next);
  console.log('User creating quiz:', req.user);
  
  // Add user to req.body
  req.body.createdBy = req.user.id;

  const quiz = await Quiz.create(req.body);

  res.status(201).json({
    success: true,
    data: quiz
  });
});

// @desc    Get all quizzes
// @route   GET /api/quizzes
// @access  Private
exports.getQuizzes = asyncHandler(async (req, res, next) => {
  // If user is admin, get all quizzes, otherwise only get active ones
  const filter = req.user.role === 'admin' ? {} : { isActive: true };
  
  const quizzes = await Quiz.find(filter).sort('-createdAt');
  
  res.status(200).json({
    success: true,
    count: quizzes.length,
    data: quizzes
  });
});

// @desc    Get single quiz
// @route   GET /api/quizzes/:id
// @access  Private
exports.getQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id);

  if (!quiz) {
    return next(
      new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404)
    );
  }

  // If user is not admin and quiz is not active, don't return it
  if (req.user.role !== 'admin' && !quiz.isActive) {
    return next(
      new ErrorResponse(`Not authorized to access this quiz`, 401)
    );
  }

  res.status(200).json({
    success: true,
    data: quiz
  });
});

// @desc    Update quiz
// @route   PUT /api/quizzes/:id
// @access  Private/Admin
exports.updateQuiz = asyncHandler(async (req, res, next) => {
  let quiz = await Quiz.findById(req.params.id);

  if (!quiz) {
    return next(
      new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is quiz owner or admin
  if (quiz.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to update this quiz`, 401)
    );
  }

  // Prevent changing certain fields after the quiz has attempts
  if (quiz.attempts && quiz.attempts.length > 0) {
    // Only allow updating isActive status
    if (Object.keys(req.body).length > 1 || !('isActive' in req.body)) {
      return next(
        new ErrorResponse('Cannot update quiz with existing attempts', 400)
      );
    }
  }

  quiz = await Quiz.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    success: true,
    data: quiz
  });
});

// @desc    Delete quiz
// @route   DELETE /api/quizzes/:id
// @access  Private/Admin
exports.deleteQuiz = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id);

  if (!quiz) {
    return next(
      new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404)
    );
  }

  // Make sure user is quiz owner or admin
  if (quiz.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(
      new ErrorResponse(`User ${req.user.id} is not authorized to delete this quiz`, 401)
    );
  }

  await quiz.remove();

  res.status(200).json({
    success: true,
    data: {}
  });
});

// @desc    Get quiz by URL slug
// @route   GET /api/quizzes/slug/:slug
// @access  Public
exports.getQuizBySlug = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findOne({ 
    quizUrlSlug: req.params.slug,
    isActive: true 
  });

  if (!quiz) {
    return next(
      new ErrorResponse(`Quiz not found with slug of ${req.params.slug}`, 404)
    );
  }

  // Return a minimal response without answers
  const { questions, ...quizData } = quiz.toObject();
  
  res.status(200).json({
    success: true,
    data: {
      ...quizData,
      questionCount: questions.length
    }
  });
});

// @desc    Get quiz for taking (public, hides correct answers)
// @route   GET /api/quizzes/take/:id
// @access  Public
exports.getQuizForTaking = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.id);

  if (!quiz) {
    return next(new ErrorResponse(`Quiz not found with id of ${req.params.id}`, 404));
  }

  if (!quiz.isActive) {
    return next(new ErrorResponse('This quiz is not currently active', 400));
  }

  const safeQuestions = (quiz.questions || []).map((q) => ({
    _id: q._id,
    questionText: q.questionText,
    options: q.options,
    marks: q.marks,
  }));

  res.status(200).json({
    success: true,
    data: {
      _id: quiz._id,
      title: quiz.title,
      description: quiz.description,
      examDuration: quiz.examDuration,
      tabSwitchLimit: quiz.tabSwitchLimit,
      totalMarks: quiz.totalMarks,
      questions: safeQuestions,
    },
  });
});
