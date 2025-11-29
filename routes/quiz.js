const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createQuiz,
  getQuizzes,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  getQuizBySlug,
  getQuizForTaking
} = require('../controllers/quizController');

// Public routes
router.get('/slug/:slug', getQuizBySlug);
router.get('/take/:id', getQuizForTaking);

// Protected routes (require authentication)
router.use(protect);

// All routes below this line will require authentication
router
  .route('/')
  .get(getQuizzes)
  .post(authorize('admin'), createQuiz);

router
  .route('/:id')
  .get(getQuiz)
  .put(authorize('admin'), updateQuiz)
  .delete(authorize('admin'), deleteQuiz);

module.exports = router;
