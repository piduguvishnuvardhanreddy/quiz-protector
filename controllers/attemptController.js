const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Start a new quiz attempt
// @route   POST /api/attempts/start
// @access  Public
exports.startAttempt = asyncHandler(async (req, res, next) => {
  const { quizId, name, email } = req.body;

  // Find the quiz
  const quiz = await Quiz.findById(quizId);
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', 404));
  }

  // Check if quiz is active
  if (!quiz.isActive) {
    return next(new ErrorResponse('This quiz is not currently active', 400));
  }

  // Check if user already has an active attempt
  const existingAttempt = await QuizAttempt.findOne({
    quiz: quizId,
    studentEmail: email,
    endTime: { $exists: false },
    isTerminatedDueToTabSwitch: false
  });

  if (existingAttempt) {
    return res.status(200).json({
      success: true,
      data: existingAttempt,
      message: 'Resuming existing attempt'
    });
  }

  // Create new attempt
  const attempt = await QuizAttempt.create({
    quiz: quizId,
    studentName: name,
    studentEmail: email,
    studentUserId: req.user ? req.user.id : undefined,
    maxScore: quiz.totalMarks,
    tabSwitchLimit: quiz.tabSwitchLimit,
    startTime: Date.now()
  });

  res.status(201).json({
    success: true,
    data: attempt
  });
});

// @desc    Submit quiz answers
// @route   POST /api/attempts/:attemptId/answers
// @access  Private
exports.submitAnswers = asyncHandler(async (req, res, next) => {
  const { answers } = req.body;
  const attempt = await QuizAttempt.findById(req.params.attemptId).populate('quiz');

  if (!attempt) {
    return next(new ErrorResponse('Attempt not found', 404));
  }

  // Check if attempt is already submitted
  if (attempt.endTime) {
    // If already submitted, just return the existing attempt data instead of error
    return res.status(200).json({
      success: true,
      data: attempt,
      message: 'Attempt was already submitted'
    });
  }

  // Get the quiz to validate answers
  const quiz = await Quiz.findById(attempt.quiz);
  
  // If exam was terminated due to tab switching, don't allow manual submission
  if (attempt.isTerminatedDueToTabSwitch) {
    return res.status(200).json({
      success: true,
      data: attempt,
      message: 'Exam was terminated due to malpractice'
    });
  }
  
  // Calculate score and prepare answers array
  let score = 0;
  const processedAnswers = [];
  
  for (const answer of answers) {
    const question = quiz.questions.id(answer.questionId);
    if (!question) continue;
    
    const isCorrect = question.correctOptionIndex === answer.selectedOptionIndex;
    const marksAwarded = isCorrect ? question.marks : 0;
    
    score += marksAwarded;
    
    processedAnswers.push({
      questionId: answer.questionId,
      selectedOptionIndex: answer.selectedOptionIndex,
      isCorrect,
      marksAwarded
    });
  }

  // Update attempt with answers and score
  attempt.answers = processedAnswers;
  attempt.score = score;
  attempt.endTime = Date.now();
  
  await attempt.save();

  res.status(200).json({
    success: true,
    data: attempt
  });
});

// @desc    Record a tab switch
// @route   PATCH /api/attempts/:attemptId/tabswitch
// @access  Private
exports.recordTabSwitch = asyncHandler(async (req, res, next) => {
  const attempt = await QuizAttempt.findById(req.params.attemptId);
  
  if (!attempt) {
    return next(new ErrorResponse('Attempt not found', 404));
  }

  // Check if attempt is already submitted or terminated
  if (attempt.endTime || attempt.isTerminatedDueToTabSwitch) {
    return next(new ErrorResponse('This attempt has already been submitted or terminated', 400));
  }

  // Increment tab switch count
  attempt.tabSwitchCount += 1;
  
  // Check if tab switch limit is exceeded
  if (attempt.tabSwitchCount > attempt.tabSwitchLimit) {
    attempt.isTerminatedDueToTabSwitch = true;
    attempt.score = 0; // Set score to 0 for malpractice
    attempt.endTime = Date.now();
    
    await attempt.save();
    
    return res.status(200).json({
      success: false,
      terminated: true,
      message: 'Attempt terminated due to excessive tab switching - Malpractice detected',
      data: attempt
    });
  }

  await attempt.save();

  res.status(200).json({
    success: true,
    tabSwitchCount: attempt.tabSwitchCount,
    tabSwitchLimit: attempt.tabSwitchLimit,
    terminated: false
  });
});

// @desc    Submit feedback for an attempt
// @route   POST /api/attempts/:attemptId/feedback
// @access  Private
exports.submitFeedback = asyncHandler(async (req, res, next) => {
  const { feedback } = req.body;
  
  const attempt = await QuizAttempt.findByIdAndUpdate(
    req.params.attemptId,
    { feedback },
    { new: true, runValidators: true }
  );

  if (!attempt) {
    return next(new ErrorResponse('Attempt not found', 404));
  }

  res.status(200).json({
    success: true,
    data: attempt
  });
});

// @desc    Get attempt details
// @route   GET /api/attempts/:id
// @access  Private
exports.getAttempt = asyncHandler(async (req, res, next) => {
  const attempt = await QuizAttempt.findById(req.params.id)
    .populate('quiz', 'title description createdBy')
    .populate('studentUserId', 'name email');

  if (!attempt) {
    return next(new ErrorResponse('Attempt not found', 404));
  }

  // Check if user is authorized to view this attempt
  const isOwner = req.user && (
    (attempt.studentUserId && attempt.studentUserId._id.toString() === req.user.id) ||
    (attempt.studentEmail && attempt.studentEmail === req.user.email)
  );
  
  const isAdmin = req.user && req.user.role === 'admin';
  const isQuizOwner =
    req.user &&
    req.user.role === 'admin' &&
    attempt.quiz &&
    attempt.quiz.createdBy &&
    attempt.quiz.createdBy.toString() === req.user.id;

  if (!isOwner && !isAdmin && !isQuizOwner) {
    return next(new ErrorResponse('Not authorized to view this attempt', 401));
  }

  res.status(200).json({
    success: true,
    data: attempt
  });
});

// @desc    Get all attempts for a quiz (admin only)
// @route   GET /api/quizzes/:quizId/attempts
// @access  Private/Admin
exports.getQuizAttempts = asyncHandler(async (req, res, next) => {
  const quiz = await Quiz.findById(req.params.quizId);
  
  if (!quiz) {
    return next(new ErrorResponse('Quiz not found', 404));
  }

  // Check if user is quiz owner or admin
  if (quiz.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('Not authorized to view attempts for this quiz', 401));
  }

  const attempts = await QuizAttempt.find({ quiz: req.params.quizId })
    .sort('-createdAt')
    .populate('studentUserId', 'name email');

  res.status(200).json({
    success: true,
    count: attempts.length,
    data: attempts
  });
});

// @desc    Get my attempts (student)
// @route   GET /api/attempts/my-attempts
// @access  Private (Student/Admin)
exports.getMyAttempts = asyncHandler(async (req, res, next) => {
  const query = {};
  
  if (req.user.role === 'student') {
    // For students, get attempts by their user ID or email
    query.$or = [
      { studentUserId: req.user.id },
      { studentEmail: req.user.email }
    ];
  } else if (req.user.role === 'admin') {
    // Admins can see all attempts or filter by their own
    query.$or = [
      { studentUserId: req.user.id },
      { studentEmail: req.user.email }
    ];
  }

  const attempts = await QuizAttempt.find(query)
    .sort('-createdAt')
    .populate('quiz', 'title description totalMarks examDuration quizUrlSlug');

  res.status(200).json({
    success: true,
    count: attempts.length,
    data: attempts
  });
});
