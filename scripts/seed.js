/* eslint-disable no-console */
const mongoose = require('mongoose');
const crypto = require('crypto');
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const User = require('../models/User');
const Quiz = require('../models/Quiz');

async function connect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to backend/.env');
    process.exit(1);
  }
  await mongoose.connect(uri);
}

function genPassword(len = 12) {
  return crypto.randomBytes(Math.ceil(len / 2)).toString('hex').slice(0, len);
}

async function ensureAdmin() {
  const name = process.env.ADMIN_NAME || 'Admin User';
  const email = process.env.ADMIN_EMAIL || 'admin@example.com';
  let password = process.env.ADMIN_PASSWORD || genPassword(14);
  const reset = String(process.env.RESET_ADMIN_PASSWORD || '').toLowerCase() === 'true';

  let user = await User.findOne({ email });
  if (!user) {
    user = await User.create({ name, email, password, role: 'admin' });
    return { user, created: true, passwordPlain: password };
  }

  if (reset && process.env.ADMIN_PASSWORD) {
    user.password = process.env.ADMIN_PASSWORD;
    await user.save();
    password = process.env.ADMIN_PASSWORD;
    return { user, created: false, reset: true, passwordPlain: password };
  }

  return { user, created: false };
}

async function ensureSampleQuiz(adminId) {
  const create = String(process.env.CREATE_SAMPLE_QUIZ || 'true').toLowerCase() !== 'false';
  if (!create) return null;

  const existing = await Quiz.findOne({ createdBy: adminId, title: 'Sample Quiz' });
  if (existing) return existing;

  const quiz = await Quiz.create({
    title: 'Sample Quiz',
    description: 'A quick sample quiz to verify the flow.',
    createdBy: adminId,
    examDuration: 10,
    tabSwitchLimit: 2,
    isActive: true,
    questions: [
      {
        questionText: 'What is 2 + 2?',
        options: ['1', '2', '3', '4'],
        correctOptionIndex: 3,
        marks: 1,
      },
      {
        questionText: 'Capital of France?',
        options: ['Berlin', 'Madrid', 'Paris', 'Rome'],
        correctOptionIndex: 2,
        marks: 1,
      },
      {
        questionText: 'Which is a JS framework?',
        options: ['Django', 'Flask', 'React', 'Laravel'],
        correctOptionIndex: 2,
        marks: 1,
      },
    ],
  });
  return quiz;
}

(async function run() {
  try {
    await connect();
    console.log('Connected to MongoDB');

    const admin = await ensureAdmin();
    if (admin.created) {
      console.log(`Admin created: ${admin.user.email}`);
      console.log(`Password: ${admin.passwordPlain}`);
    } else if (admin.reset) {
      console.log(`Admin password reset: ${admin.user.email}`);
      console.log(`New Password: ${admin.passwordPlain}`);
    } else {
      console.log(`Admin exists: ${admin.user.email}`);
    }

    const quiz = await ensureSampleQuiz(admin.user._id);
    if (quiz) {
      console.log('Sample quiz created:', quiz.title);
      console.log('Share URL (slug): /quiz/' + quiz.quizUrlSlug);
    } else {
      console.log('Sample quiz creation skipped or already exists.');
    }

    console.log('Seeding done.');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err);
    try { await mongoose.disconnect(); } catch {}
    process.exit(1);
  }
})();
