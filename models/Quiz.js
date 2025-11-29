const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  questionText: {
    type: String,
    required: [true, 'Please provide question text'],
    trim: true
  },
  options: {
    type: [String],
    required: [true, 'Please provide options'],
    validate: {
      validator: function (options) {
        return options.length === 4; // Ensure exactly 4 options
      },
      message: 'There must be exactly 4 options'
    }
  },
  correctOptionIndex: {
    type: Number,
    required: [true, 'Please provide the index of the correct option'],
    min: 0,
    max: 3
  },
  marks: {
    type: Number,
    required: [true, 'Please provide marks for this question'],
    min: [1, 'Marks must be at least 1']
  }
});

const quizSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Please provide a title for the quiz'],
    trim: true,
    maxlength: [100, 'Title cannot be more than 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot be more than 500 characters']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  questions: [questionSchema],
  totalMarks: {
    type: Number,
    default: 0
  },
  examDuration: {
    type: Number, // in minutes
    required: [true, 'Please provide exam duration in minutes'],
    min: [1, 'Exam duration must be at least 1 minute']
  },
  tabSwitchLimit: {
    type: Number,
    required: [true, 'Please provide tab switch limit'],
    min: [0, 'Tab switch limit cannot be negative'],
    default: 3
  },
  isActive: {
    type: Boolean,
    default: true
  },
  quizUrlSlug: {
    type: String,
    unique: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Calculate total marks before saving
quizSchema.pre('save', async function() {
  if (this.questions && this.questions.length > 0) {
    this.totalMarks = this.questions.reduce((sum, question) => sum + question.marks, 0);
  } else {
    this.totalMarks = 0;
  }
  
  // Generate a URL-friendly slug if not provided
  if (!this.quizUrlSlug) {
    this.quizUrlSlug = this.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^\-|\-$)/g, '') + '-' + Math.random().toString(36).substr(2, 9);
  }
});

// Update the updatedAt timestamp on update
quizSchema.pre('findOneAndUpdate', function() {
  this.set({ updatedAt: new Date() });
});

module.exports = mongoose.model('Quiz', quizSchema);
