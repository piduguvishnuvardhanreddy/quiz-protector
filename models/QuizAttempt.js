const mongoose = require('mongoose');

const answerSchema = new mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  selectedOptionIndex: {
    type: Number,
    required: true,
    min: 0,
    max: 3
  },
  isCorrect: {
    type: Boolean,
    default: false
  },
  marksAwarded: {
    type: Number,
    default: 0
  }
});

const quizAttemptSchema = new mongoose.Schema({
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  studentName: {
    type: String,
    required: [true, 'Please provide student name'],
    trim: true
  },
  studentEmail: {
    type: String,
    required: [true, 'Please provide student email'],
    lowercase: true,
    trim: true
  },
  studentUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional, if the student is logged in
  },
  score: {
    type: Number,
    default: 0
  },
  maxScore: {
    type: Number,
    required: true
  },
  tabSwitchCount: {
    type: Number,
    default: 0
  },
  tabSwitchLimit: {
    type: Number,
    required: true
  },
  isTerminatedDueToTabSwitch: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  answers: [answerSchema],
  feedback: {
    type: String,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate score and time spent before saving
quizAttemptSchema.pre('save', async function() {
  // If this is a completed attempt, calculate the score
  if (this.answers && this.answers.length > 0) {
    this.score = this.answers.reduce((sum, answer) => sum + (answer.marksAwarded || 0), 0);
  }
  
  // Calculate time spent if endTime is set
  if (this.endTime) {
    this.timeSpent = Math.floor((this.endTime - this.startTime) / 1000); // in seconds
  }
});

// Add a method to check if the attempt is still active
quizAttemptSchema.methods.isActive = function() {
  if (this.isTerminatedDueToTabSwitch) return false;
  if (!this.endTime) return true;
  
  const quizDuration = this.quiz ? this.quiz.examDuration * 60 * 1000 : 0; // Convert minutes to ms
  const timeElapsed = Date.now() - this.startTime.getTime();
  
  return timeElapsed < quizDuration;
};

// Add a method to get remaining time in seconds
quizAttemptSchema.methods.getRemainingTime = function() {
  if (!this.quiz) return 0;
  
  const quizDurationMs = this.quiz.examDuration * 60 * 1000; // Convert minutes to ms
  const timeElapsed = Date.now() - this.startTime.getTime();
  const remainingMs = Math.max(0, quizDurationMs - timeElapsed);
  
  return Math.floor(remainingMs / 1000); // Convert to seconds
};

module.exports = mongoose.model('QuizAttempt', quizAttemptSchema);
