const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  startAttempt,
  submitAnswers,
  recordTabSwitch,
  submitFeedback,
  getAttempt,
  getQuizAttempts,
  getMyAttempts
} = require('../controllers/attemptController');

// Public route - no authentication required to start an attempt
router.post('/start', startAttempt);

// Protected routes - require authentication
router.use(protect);

// Quiz-specific attempt routes
router
  .route('/')
  .post(submitAnswers);

router
  .route('/:attemptId/answers')
  .post(submitAnswers);

router
  .route('/:attemptId/tabswitch')
  .patch(recordTabSwitch);

router
  .route('/:attemptId/feedback')
  .post(submitFeedback);

// Student route - get my attempts (MUST be before /:id route)
router.get('/my-attempts', getMyAttempts);

router
  .route('/:id')
  .get(getAttempt);

// Admin routes
router.get('/quizzes/:quizId/attempts', 
  authorize('admin'), 
  getQuizAttempts
);

module.exports = router;
