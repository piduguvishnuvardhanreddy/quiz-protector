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

// Public routes - no authentication required for taking exams
router.post('/start', startAttempt);
router.get('/:id', getAttempt);
router.patch('/:attemptId/tabswitch', recordTabSwitch);
router.post('/:attemptId/answers', submitAnswers);
router.post('/:attemptId/feedback', submitFeedback);

// Protected routes - require authentication
router.use(protect);

// Student route - get my attempts (MUST be before other protected routes)
router.get('/my-attempts', getMyAttempts);

// Admin routes
router.get('/quizzes/:quizId/attempts', 
  authorize('admin'), 
  getQuizAttempts
);

module.exports = router;
