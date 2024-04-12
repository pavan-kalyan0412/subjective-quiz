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
  question: String,
  answer: String,
  timer: Number,
  marks: Number,
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
});

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
    adminEvaluation: [String],
  }],
  totalMarksSecured: Number,
  evaluationDate: {
    type: Date,
    default: Date.now
  }
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

