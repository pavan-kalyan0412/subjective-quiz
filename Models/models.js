const mongoose = require("mongoose");

const RegisterSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  email: String,
});

const User = mongoose.model("User", RegisterSchema);

const QuizSchema = new mongoose.Schema({
  title: String,
  description: String,
  timerDuration: Number,
  subTopics: [
    {
      _id: mongoose.Schema.Types.ObjectId,
      description: String
    }
  ],
  questions: [
    {
      subTopicId: mongoose.Schema.Types.ObjectId,
      question: String,
      answer: String,
      marks: Number,
    }
  ]
});

const Quiz = mongoose.model('Quiz', QuizSchema);

const QuestionSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  question: String,
  answer: String,
  timer: Number,
  marks: Number,
  isCodingQuestion: {
    type: Boolean,
    default: false,
  },
  questionType: {
    type: String,
    enum: ['subjective', 'coding', 'mcq'],
    default: 'subjective',
  },
  options: [{
    type: String,
  }],
  correctOptionIndex: {
    type: Number,
    default: null,
  },
  imageUrl: {
    type: String,
    default: null,
  },
});

const SubTopicSchema = new mongoose.Schema({
  subTopic: String,
  totalTimer: Number,
  questions: [QuestionSchema]
});

const MainTopicSchema = new mongoose.Schema({
  mainTopic: String,
  subTopics: [SubTopicSchema]
});

const MainTopic = mongoose.model('MainTopic', MainTopicSchema);

const submissionSchema = new mongoose.Schema({
  userId: String,
  mainTopicId: String,
  subTopicId: String,
  mainTopicName: String,
  subTopicName: String,
  questions: [{
    question: String,
    adminAnswer: String,
    userAnswer: String,
    marks: Number,
  }],
  isEvaluated: {
    type: Boolean,
    default: false,
  },
  submittedAt: {
    type: Date,
    default: Date.now,
  }
});

// Add a unique index to prevent duplicate submissions
submissionSchema.index({ userId: 1, mainTopicId: 1, subTopicId: 1 }, { unique: true });

const Submission = mongoose.model('Submission', submissionSchema);

const evaluatedSchema = new mongoose.Schema({
  submissionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Submission',
    required: true,
  },
  userId: {
    type: String,
    required: true,
  },
  mainTopicName: {
    type: String,
    required: true,
  },
  subTopicName: {
    type: String,
    required: true,
  },
  evaluations: [{
    question: String,
    userAnswer: String,
    adminAnswer: String,
    adminEvaluation: [String], // Marks secured (e.g., "4")
    marks: Number, // Allotted marks (e.g., 5)
    isCodingQuestion: {
      type: Boolean,
      default: false,
    },
    questionType: {
      type: String,
      enum: ['subjective', 'coding', 'mcq'],
      default: 'subjective',
    },
    options: [{
      type: String,
    }],
    correctOptionIndex: {
      type: Number,
      default: null,
    },
    userOptionIndex: {
      type: Number,
      default: null,
    },
  }],
  totalMarksSecured: Number,
  totalMarksAllotted: Number, // Total allotted marks
  evaluationDate: {
    type: Date,
    default: Date.now,
  },
});

const Evaluated = mongoose.model('Evaluated', evaluatedSchema);

const adminSchema = new mongoose.Schema({
  username: String,
  password: String,
});

const Admin = mongoose.model('Admin', adminSchema);

module.exports = {
  User,
  Quiz,
  MainTopic,
  Submission,
  Evaluated,
  Admin
};

