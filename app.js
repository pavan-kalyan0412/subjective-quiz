const express = require('express');
const app = express();
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();
const multer = require('multer');

const {exec} = require('child_process');
const sanitizeFilename = require('sanitize-filename');
const fsPromises = require('fs').promises;
const PDFDocument = require('pdfkit');

const PORT = process.env.PORT || 3000;
// const MONGO_URL = process.env.DB_URL;


// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/uploads'); // Store images in public/uploads
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename with timestamp
  },
});
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb('Error: Images only (jpeg, jpg, png)!');
    }
  },
});


const uploadDir = './public/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from public/uploads
app.use('/uploads', express.static('public/uploads'));

const MONGO_URL = process.env.DB_URL || 'mongodb://localhost:27017/bootcamp';

// Parse incoming requests with JSON payloads
app.use(bodyParser.json());

// Parse incoming requests with urlencoded payloads
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the current directory
app.use(express.static((__dirname)));

app.set('view engine', 'ejs');

app.set('views', path.join(__dirname, 'views'));


// Configure session middleware
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
}));

const {
  User,
  Quiz,
  MainTopic,
  Submission,
  Evaluated,
  Admin
} = require('./Models/models')

if (!MONGO_URL) {
  console.error('Error: DB_URL is not defined in the .env file.');
  process.exit(1);
}

// mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => {
//     console.log('Connected to MongoDB');
//     // Create an index on the 'email' field to improve query performance
//     User.collection.createIndex({ email: 1 });
//   })
//   .catch((error) => {
//     console.error('Error connecting to MongoDB:', error.message);
//     process.exit(1);
//   });

//   const RegisterSchema = new mongoose.Schema({
//     firstName: String,
//     lastName: String,
//     email: String,
//   });

//   const User = mongoose.model("User", RegisterSchema);

//   const QuizSchema = new mongoose.Schema({
//     title: String,
//     description: String,
//     timerDuration: Number,
//     subTopics: [
//       {
//         _id: mongoose.Schema.Types.ObjectId, // Unique ID for the sub-topic
//         description: String
//       }
//     ],
//     questions: [
//       {
//         subTopicId: mongoose.Schema.Types.ObjectId, // Reference to the sub-topic's _id
//         question: String,
//         answer: String,
//         marks: Number,
//       }
//     ]
//   });
  
//   const Quiz = mongoose.model('Quiz', QuizSchema);

//   const QuestionSchema = new mongoose.Schema({
//     question: String,
//     answer: String,
//     timer: Number,
//     marks: Number,
//   });

//   const SubTopicSchema = new mongoose.Schema({
//   subTopic: String,
//   totalTimer: Number,
//   questions: [QuestionSchema] // Array of questions
// });
  
//   const MainTopicSchema = new mongoose.Schema({
//     mainTopic: String,
//     subTopics: [SubTopicSchema] // Array of subtopics
//   });
  
//   const MainTopic = mongoose.model('MainTopic', MainTopicSchema);
  
//   module.exports = { MainTopic };
  
//   const submissionSchema = new mongoose.Schema({
//     userId: String,
//     mainTopicId: String,
//     subTopicId: String,
//     mainTopicName: String,
//     subTopicName: String,
//     questions: [{
//       question: String,
//       adminAnswer: String,
//       userAnswer: String,
//       marks: Number,
//     }],
//     isEvaluated: {
//       type: Boolean,
//       default: false, // Set the default value to false
//     },
//   });
  
  
//   const Submission = mongoose.model('Submission', submissionSchema);

//   const evaluatedSchema = new mongoose.Schema({
//     submissionId: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'Submission',
//       required: true,
//     },
//     userId: {
//       type: String, // Assuming the user's email is a string
//       required: true,
//     },
//     mainTopicName: {
//       type: String,
//       required: true,
//     },
//     subTopicName: {
//       type: String,
//       required: true,
//     },
//     evaluations: [{
//       question: String,
//       userAnswer: String,
//       adminAnswer: String, // Added field for admin's answer
//       adminEvaluation: [String],
//     }],
//     totalMarksSecured: Number,
//     evaluationDate: {
//       type: Date,
//       default: Date.now // Set the default date to the current date and time
//     }
//   });
  
//   const Evaluated = mongoose.model('Evaluated', evaluatedSchema);
  
//   const adminSchema = new mongoose.Schema({
//     username: String,
//     password: String,
//   });
  
//   const Admin = mongoose.model('Admin', adminSchema);

  async function initializeAdmin() {
    try {
      const admin = await Admin.findOne({ username: 'admin' });
  
      if (!admin) {
        // Create the admin with the hardcoded credentials if it doesn't exist
        const adminData = {
          username: 'admin',
          password: 'adminPassword', // Hardcoded initial password
        };
        const createdAdmin = await Admin.create(adminData);
        console.log('Admin initialized with hardcoded credentials:', createdAdmin);
      }
    } catch (error) {
      console.error('Error checking/admin initializing:', error);
    }
  }
  
  // Call the function to initialize the admin
  initializeAdmin();
  

  mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    console.log('Connected to MongoDB');
    await User.collection.createIndex({ email: 1 });
    await initializeAdmin();
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error.message);
    process.exit(1);
  });

  // Middleware to check if the user is authenticated
function checkAuthentication(req, res, next) {
  if (!req.session.email) {
    return res.redirect('/'); // Redirect to the registration page if not authenticated
  }
  next(); // Proceed to the next middleware or route handler
}

// Middleware to check if the admin is authenticated
function checkAdminAuthentication(req, res, next) {
  if (!req.session.isAdminAuthenticated) {
    return res.redirect('/admin'); // Redirect to the admin login page if not authenticated
  }
  next(); // Proceed to the next middleware or route handler
}

const activeQuizSessions = {};


  // Register route to display the registration page
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/landing.html');
});


app.get('/register', (req, res) =>{
  res.sendFile(__dirname + '/register.html');
});

app.post('/register', async (req, res) => {
  const { firstName, lastName, email } = req.body;
  req.session.firstName = firstName;
  req.session.lastName = lastName;
  req.session.email = email;
  console.log('firstName after register:', req.session.firstName);

  try {
    // Check if a user with the same email already exists
    const existingUser = await User.findOne({ email });

    if (!existingUser) {
      // Store user's first name and last name in session
      req.session.firstName = firstName;
      req.session.lastName = lastName;
      req.session.email = email;

      // Create a new user using the User model
      await User.create({ firstName, lastName, email });
    }

    // Redirect the user to the homepage after registration
    res.redirect('/homepage');
  } catch (error) {
    console.error('Error during registration:', error);
    res.status(500).send('An error occurred during registration.');
  }
});

app.get('/admin', (req, res) => {
  res.render('admin-login', { error: null }); // Pass the error variable as null initially
});

app.post('/admin-login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Check if there is an admin with the provided username
    const admin = await Admin.findOne({ username });

    if (!admin) {
      return res.render('admin-login', { error: 'Invalid credentials' });
    }

    // Check if the provided password matches the stored password
    if (admin.password === password) {
      // Set a session variable to indicate admin is authenticated
      req.session.isAdminAuthenticated = true;

      // Check if the admin's username and password are still the hardcoded values
      if (admin.username === 'admin' && admin.password === 'adminPassword') {
        res.redirect('/admin/settings'); // Redirect to admin-settings for initial password change
      } else {
        res.redirect('/admin/dashboard'); // Redirect to the admin dashboard
      }
    } else {
      res.render('admin-login', { error: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error during admin authentication:', error);
    res.status(500).send('An error occurred during admin authentication.');
  }
});


app.get('/admin/dashboard',checkAdminAuthentication, async (req, res) => {
  try {
    const mainTopics = await MainTopic.find(); // Retrieve main topics from the database
    
    // Fetch the submissions data from your database
    const submissions = await Submission.find();
    
    // Calculate the count of not evaluated answers
    const notEvaluatedCount = submissions.filter(submission => !submission.isEvaluated).length;


    // Render the admin-dashboard template and pass mainTopics to it
     res.render('admin-dashboard', { mainTopics, submissions, notEvaluatedCount });
  } catch (error) {
    console.error('Error fetching main topics:', error);
    res.status(500).send('An error occurred while fetching main topics.');
  }
});


app.get('/admin/add-main-topic', checkAdminAuthentication, (req, res) => {
  res.render('add-main-topic'); // Render the template for adding main topics
});

app.post('/admin/add-main-topic', async (req, res) => {
  let { mainTopic } = req.body;

  // Convert the mainTopic string to uppercase
  mainTopic = mainTopic.toUpperCase();

  try {
    // Check if a main topic with the same name already exists
    const existingMainTopic = await MainTopic.findOne({ mainTopic });

    if (existingMainTopic) {
      // Display an alert to the user and prevent adding the duplicate main topic
      return res.send('<script>alert("Main topic with the same name already exists."); window.location="/admin/add-main-topic";</script>');
    }

    // If no duplicate exists, add the new main topic with the uppercase name
    await MainTopic.create({ mainTopic });

    res.redirect('/admin/dashboard'); // Redirect back to the admin dashboard
  } catch (error) {
    console.error('Error adding main topic:', error);
    res.status(500).send('An error occurred while adding the main topic.');
  }
});



app.get('/admin/add-subtopic/:mainTopicId', checkAdminAuthentication, (req, res) => {
  const mainTopicId = req.params.mainTopicId;

  res.render('add-subtopic', { mainTopicId });
});

app.post('/admin/add-subtopic/:mainTopicId', async (req, res) => {
  const mainTopicId = req.params.mainTopicId;
  let { subTopic } = req.body;

  // Convert the subtopic to lowercase
  subTopic = subTopic.toLowerCase();

  try {
    const mainTopic = await MainTopic.findById(mainTopicId);

    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    // Check for existing subtopics with the same name
    const existingSubtopic = mainTopic.subTopics.some((sub) => sub.subTopic === subTopic);

    if (existingSubtopic) {
      // Handle duplicate subtopic error
      return res.status(400).send('Subtopic with the same name already exists.');
    }

    // Add the new subtopic with the lowercase name
    mainTopic.subTopics.push({ subTopic });
    await mainTopic.save();

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error adding subtopic:', error);
    res.status(500).send('An error occurred while adding the subtopic.');
  }
});




app.get('/admin/add-questions/:mainTopicId/:subTopicId', checkAdminAuthentication, (req, res) => {
  const { mainTopicId, subTopicId } = req.params;
  res.render('add-questions', { mainTopicId, subTopicId });
});


// Update the route to handle multiple file uploads
app.post('/admin/save-questions', (req, res, next) => {
  console.log('Incoming files:', req.files);
  console.log('Incoming body:', req.body);
  next();
}, upload.any(), async (req, res) => {
  const { mainTopicId, subTopicId, questions, answers, timers, marks, questionType, options, correctOptionIndex } = req.body;
  const files = req.files; // Array of all uploaded files

  try {
    const mainTopic = await MainTopic.findById(mainTopicId);
    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);
    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    if (!subTopic.questions) {
      subTopic.questions = [];
    }

    for (let i = 0; i < questions.length; i++) {
      const isQuestionDuplicate = mainTopic.subTopics.some((sub) =>
        sub.questions.some((q) => q.question === questions[i])
      );
      if (isQuestionDuplicate) {
        return res.send(
          `<script>alert("Question already exists in another subtopic or main topic."); window.location="/admin/add-questions/${mainTopicId}/${subTopicId}";</script>`
        );
      }

      const questionData = {
        question: questions[i],
        timer: parseInt(timers[i]) || 0,
        marks: parseInt(marks[i]) || 0,
        questionType: questionType[i] || 'subjective',
      };

      if (questionType[i] === 'mcq') {
        questionData.options = Array.isArray(options[i]) ? options[i].filter(opt => opt.trim() !== '') : [];
        questionData.correctOptionIndex = correctOptionIndex[i] ? parseInt(correctOptionIndex[i]) : null;
        questionData.answer = answers[i] || '';
        if (questionData.options.length < 2 || questionData.correctOptionIndex === null) {
          return res.send(
            `<script>alert("MCQ must have at least 2 valid options and a correct option selected."); window.location="/admin/add-questions/${mainTopicId}/${subTopicId}";</script>`
          );
        }
      } else {
        questionData.answer = answers[i] || '';
        questionData.isCodingQuestion = questionType[i] === 'coding';
        // Find the corresponding file for this question
        const file = files.find(f => f.fieldname === `image${i}`);
        if (questionType[i] === 'coding' && file) {
          questionData.imageUrl = `/uploads/${file.filename}`;
        }
      }

      subTopic.questions.push(questionData);
    }

    await mainTopic.save();
    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error adding questions:', error);
    res.status(500).send('An error occurred while adding questions.');
  }
});




app.get('/admin/view-questions/:mainTopicId/:subTopicId', checkAdminAuthentication, async (req, res) => {
  const mainTopicId = req.params.mainTopicId;
  const subTopicId = req.params.subTopicId;

  try {
    const mainTopic = await MainTopic.findById(mainTopicId);
    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);
    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    const totalTimerDuration = subTopic.questions.reduce((total, question) => total + (question.timer || 0), 0);

    res.render('view-questions', { mainTopic, subTopic, totalTimerDuration });
  } catch (error) {
    console.error('Error fetching subtopic:', error);
    res.status(500).send('An error occurred while fetching the subtopic.');
  }
});


app.get('/admin/confirm-delete-subtopic/:mainTopicId/:subTopicId', checkAdminAuthentication, (req, res) => {
  const { mainTopicId, subTopicId } = req.params;
  res.render('confirm-delete-subtopic', { mainTopicId, subTopicId });
});


app.post('/admin/delete-subtopic/:mainTopicId/:subTopicId', async (req, res) => {
  const { mainTopicId, subTopicId } = req.params;
  const { confirmSubtopicName } = req.body;

  try {
    const mainTopic = await MainTopic.findById(mainTopicId);

    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);

    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    if (confirmSubtopicName === subTopic.subTopic) {
      mainTopic.subTopics.pull(subTopicId); // Remove the subtopic using .pull()
      await mainTopic.save();
      res.redirect('/admin/dashboard');
    } else {
      // If subtopic name doesn't match, display an error message
      res.status(400).send('Subtopic name mismatch. Deletion cancelled.');
    }
  } catch (error) {
    console.error('Error deleting subtopic:', error);
    res.status(500).send('An error occurred while deleting the subtopic.');
  }
});


app.post('/admin/delete-main-topic/:mainTopicId', async (req, res) => {
  const { mainTopicId } = req.params;

  try {
    const result = await MainTopic.deleteOne({ _id: mainTopicId });

    if (result.deletedCount === 0) {
      return res.status(404).send('Main topic not found.');
    }

    res.redirect('/admin/dashboard');
  } catch (error) {
    console.error('Error deleting main topic:', error);
    res.status(500).send('An error occurred while deleting the main topic.');
  }
});

// Handle the route for starting the quiz
app.get('/start-quiz/:mainTopicId/:subTopicId', (req, res) => {
  const { mainTopicId, subTopicId } = req.params;
  // Continue with starting the quiz
  res.render('start-quiz', { mainTopicId, subTopicId });
});



app.get('/homepage',checkAuthentication, async (req, res) => {
  console.log('firstName when rendering homepage:', req.session.firstName);
  const userId = req.session.email; // Assuming email is a unique identifier for users
  try {
    // Retrieve the list of main topics and subtopics from your database
    const mainTopics = await MainTopic.find();
    
    res.render('homepage', { firstName: req.session.firstName, mainTopics});
  } catch (error) {
    console.error('Error fetching main topics:', error);
    res.status(500).send('An error occurred while fetching main topics.');
  }
});

app.get('/quiz/:mainTopicId/:subTopicId', checkAuthentication, async (req, res) => {
  try {
    const { mainTopicId, subTopicId } = req.params;
    const userId = req.session.email;

    // Check if the user has already submitted this quiz
    const existingSubmission = await Submission.findOne({
      userId,
      mainTopicId,
      subTopicId,
    });

    if (existingSubmission) {
      return res.render('quiz-already-submitted', {
        message: 'You have already submitted this quiz.',
        mainTopicId,
        subTopicId,
      });
    }

    const mainTopic = await MainTopic.findById(mainTopicId);
    if (!mainTopic) {
      console.error('Main topic not found for mainTopicId:', mainTopicId);
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);
    if (!subTopic) {
      console.error('Subtopic not found for subTopicId:', subTopicId);
      return res.status(404).send('Subtopic not found.');
    }

    const totalTimerDuration = subTopic.questions.reduce((total, question) => total + question.timer, 0);
    const questions = subTopic.questions;

    const quiz = {
      mainTopicId: mainTopicId,
      subTopicId: subTopicId,
      title: mainTopic.mainTopic,
      description: subTopic.subTopic,
      questions: questions,
      totalTimerDuration: totalTimerDuration,
      mainTopic: mainTopic,
      subTopic: subTopic,
    };

    const isUserTakingQuiz = !!activeQuizSessions[userId];
    let formSubmitted = false;

    res.render('quiz', { quiz, isUserTakingQuiz, userId, formSubmitted });
  } catch (error) {
    console.error('Error fetching subtopic:', error);
    res.status(500).send('An error occurred while fetching the subtopic.');
  }
});



app.post('/submit', async (req, res) => {
  const userId = req.session.email;
  const { mainTopicId, subTopicId, userAnswers, adminQuestions, adminAnswers, correctOptionIndex, options } = req.body;

  try {
    // Check if the user has already submitted this quiz
    const existingSubmission = await Submission.findOne({
      userId,
      mainTopicId,
      subTopicId,
    });

    if (existingSubmission) {
      return res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Submission Error</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-100 flex items-center justify-center min-h-screen">
            <div class="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
                <h2 class="text-2xl font-semibold text-gray-800 mb-2">Already Submitted!</h2>
                <p class="text-gray-600 mb-6">You have already submitted this quiz.</p>
                <a href="/homepage" class="inline-block bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700">Back to Homepage</a>
            </div>
        </body>
        </html>
      `);
    }

    const mainTopic = await MainTopic.findById(mainTopicId);
    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);
    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    const questions = subTopic.questions;
    const submissionData = [];

    for (let i = 0; i < questions.length; i++) {
      let userAnswer = '';

      if (questions[i].questionType === 'mcq') {
        const selectedIndex = userAnswers && userAnswers[i] && !isNaN(parseInt(userAnswers[i]))
          ? parseInt(userAnswers[i])
          : null;
        userAnswer = selectedIndex !== null && questions[i].options[selectedIndex]
          ? questions[i].options[selectedIndex]
          : '';
      } else {
        userAnswer = userAnswers && userAnswers[i] ? userAnswers[i] : '';
      }

      submissionData.push({
        question: questions[i].question,
        adminAnswer: questions[i].answer || (questions[i].questionType === 'mcq' ? questions[i].options[questions[i].correctOptionIndex] : ''),
        userAnswer: userAnswer,
        marks: questions[i].marks,
      });
    }

    await Submission.create({
      userId: userId,
      mainTopicId: mainTopicId,
      subTopicId: subTopicId,
      mainTopicName: mainTopic.mainTopic,
      subTopicName: subTopic.subTopic,
      questions: submissionData,
    });

    delete activeQuizSessions[userId];

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Quiz Submitted</title>
          <script src="https://cdn.tailwindcss.com"></script>
      </head>
      <body class="bg-gray-100 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
              <h2 class="text-2xl font-semibold text-gray-800 mb-2">Quiz Submitted!</h2>
              <p class="text-gray-600 mb-6">Your results will be sent to your email soon.</p>
              <a href="/homepage" class="inline-block bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700">Back to Homepage</a>
          </div>
        <script>
          window.history.pushState(null, '', '/homepage');
          window.addEventListener('popstate', () => {
            window.location.href = '/homepage';
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    res.status(500).send('An error occurred while submitting the quiz.');
  }
});

// Define a route for admin evaluation page
app.get('/admin/evaluation', checkAdminAuthentication, async (req, res) => {
  try {
    // Fetch submissions from the database (replace this with your database logic)
    const submissions = await Submission.find();

    // Render the evaluation page and pass the submissions data to it
    res.render('evaluation', { submissions});
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).send('An error occurred while fetching submissions.');
  }
});

app.get('/admin/evaluate/:submissionId', checkAdminAuthentication, async (req, res) => {
  try {
    const submissionId = req.params.submissionId;

    // Validate submissionId
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      console.warn(`Invalid submissionId: ${submissionId}`);
      return res.status(400).send('Invalid submission ID.');
    }

    // Retrieve the submission
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).send('Submission not found.');
    }

    const evaluations = [];
    res.render('evaluation-form', { submission, evaluations });
  } catch (error) {
    console.error('Error fetching submission for evaluation:', error);
    res.status(500).send(`An error occurred while fetching the submission: ${error.message}`);
  }
});


app.post('/admin/evaluate/:submissionId/submit', async (req, res) => {
  const submissionId = req.params.submissionId;
  const evaluations = req.body.evaluations;
  const totalMarksSecured = parseInt(req.body.totalMarksSecured);

  try {
    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).send('Submission not found.');
    }

    const mainTopic = await MainTopic.findById(submission.mainTopicId);
    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }
    const subTopic = mainTopic.subTopics.id(submission.subTopicId);
    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    const questionMap = {};
    subTopic.questions.forEach((q) => {
      questionMap[q.question] = {
        isCodingQuestion: q.isCodingQuestion,
        questionType: q.questionType,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        marks: q.marks,
        imageUrl: q.imageUrl,
        answer: q.answer, // Include admin answer for subjective/coding
      };
    });

    let totalMarksAllotted = 0;
    const evaluatedData = submission.questions.map((question, index) => {
      const qData = questionMap[question.question] || {};
      let userOptionIndex = null;
      if (qData.questionType === 'mcq' && question.userAnswer) {
        userOptionIndex = qData.options?.indexOf(question.userAnswer);
      }
      totalMarksAllotted += qData.marks || 0;

      return {
        question: question.question,
        adminAnswer: question.adminAnswer,
        userAnswer: question.userAnswer,
        adminEvaluation: parseInt(evaluations[index]) || 0,
        marks: qData.marks || 0,
        isCodingQuestion: qData.isCodingQuestion || false,
        questionType: qData.questionType || 'subjective',
        options: qData.options || [],
        correctOptionIndex: qData.correctOptionIndex,
        userOptionIndex: userOptionIndex,
      };
    });

    await Evaluated.create({
      submissionId: submissionId,
      userId: submission.userId,
      mainTopicName: submission.mainTopicName,
      subTopicName: submission.subTopicName,
      evaluations: evaluatedData,
      totalMarksSecured: totalMarksSecured,
      totalMarksAllotted: totalMarksAllotted,
    });

    await Submission.findByIdAndUpdate(submissionId, { isEvaluated: true });

    const percentage = totalMarksAllotted > 0 ? Math.round((totalMarksSecured / totalMarksAllotted) * 100) : 0;

    // Generate PDF using pdfkit
    const safeUserId = sanitizeFilename(submission.userId.replace(/[@.]/g, '_'));
    const pdfFileName = `evaluation_${submissionId}_${safeUserId}.pdf`;
    const tempDir = path.join(__dirname, 'temp');
    await fsPromises.mkdir(tempDir, { recursive: true });
    const pdfPath = path.join(tempDir, pdfFileName);

    const doc = new PDFDocument({ margin: 40 });
    const stream = require('fs').createWriteStream(pdfPath);
    doc.pipe(stream);

    // Cover Page
    doc.fillColor('#1E90FF').fontSize(28).font('Helvetica-Bold').text('Quiz Evaluation Results', { align: 'center' });
    doc.moveDown(2);
    doc.fillColor('black').fontSize(16).font('Helvetica').text(`Candidate: ${submission.userId}`, { align: 'center' });
    doc.text(`Main Topic: ${submission.mainTopicName}`, { align: 'center' });
    doc.text(`Sub Topic: ${submission.subTopicName}`, { align: 'center' });
    doc.moveDown(1);
    doc.fillColor('#4682B4').fontSize(14).text(`Total Marks: ${totalMarksSecured}/${totalMarksAllotted} (${percentage}%)`, { align: 'center' });
    doc.addPage();

    // Results Section
    doc.fillColor('#1E90FF').fontSize(18).font('Helvetica-Bold').text('Results', { align: 'center' });
    doc.moveDown(1);

    submission.questions.forEach((question, index) => {
      const qData = questionMap[question.question] || {};
      const isCodingQuestion = qData.isCodingQuestion || false;
      const isMCQ = qData.questionType === 'mcq';
      const securedMarks = parseInt(evaluations[index]) || 0;

      // Question Header
      doc.fillColor('#4682B4').fontSize(14).font('Helvetica-Bold').text(`Question ${index + 1}:`);
      doc.fillColor('black').fontSize(12).font(isCodingQuestion ? 'Courier' : 'Helvetica').text(question.question, { indent: 20 });

      // Image for Coding Questions
      if (isCodingQuestion && qData.imageUrl) {
        try {
          const imagePath = path.join(__dirname, 'public', qData.imageUrl);
          doc.image(imagePath, { width: 300, align: 'center' });
          doc.moveDown(0.5);
        } catch (err) {
          console.warn(`Failed to include image ${qData.imageUrl}:`, err);
          doc.fontSize(10).fillColor('red').text(`[Image not available: ${qData.imageUrl}]`, { indent: 20 });
        }
      }

      // MCQ Options
      if (isMCQ) {
        doc.moveDown(0.2);
        doc.fillColor('#4682B4').fontSize(12).font('Helvetica-Bold').text('Options:', { indent: 20 });
        qData.options.forEach((opt, i) => {
          const isCorrect = i === qData.correctOptionIndex;
          doc.fillColor(isCorrect ? '#228B22' : 'black').fontSize(12).font('Helvetica').text(
            `${String.fromCharCode(97 + i)}) ${opt}${isCorrect ? ' (Correct)' : ''}`,
            { indent: 40 }
          );
        });
      }

      // User Answer
      doc.moveDown(0.2);
      doc.fillColor('#4682B4').fontSize(12).font('Helvetica-Bold').text('Your Answer:', { indent: 20 });
      doc.fillColor('black').fontSize(12).font(isCodingQuestion ? 'Courier' : 'Helvetica').text(
        question.userAnswer || 'Skipped',
        { indent: 40, width: 450, continued: false }
      );

      // Admin Answer for Subjective or Coding Questions
      if (!isMCQ && qData.answer) {
        doc.moveDown(0.2);
        doc.fillColor('#4682B4').fontSize(12).font('Helvetica-Bold').text('Correct Answer:', { indent: 20 });
        doc.fillColor('black').fontSize(12).font(isCodingQuestion ? 'Courier' : 'Helvetica').text(
          qData.answer,
          { indent: 40, width: 450, continued: false }
        );
      }

      // Marks
      doc.moveDown(0.2);
      doc.fillColor('#4682B4').fontSize(12).font('Helvetica-Bold').text(`Allotted Marks: ${qData.marks || 0}`, { indent: 20 });
      doc.fillColor(securedMarks === qData.marks ? '#228B22' : '#FF4500').fontSize(12).font('Helvetica-Bold').text(
        `Secured Marks: ${securedMarks}/${qData.marks || 0}`,
        { indent: 20 }
      );

      // Separator Line
      doc.moveDown(0.5);
      doc.strokeColor('#D3D3D3').lineWidth(1).moveTo(40, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
    });

    // Final Total
    doc.fillColor('#1E90FF').fontSize(16).font('Helvetica-Bold').text(
      `Total Marks Secured: ${totalMarksSecured}/${totalMarksAllotted} (${percentage}%)`,
      { align: 'center' }
    );

    doc.end();

    // Wait for the PDF stream to finish
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });

    // Send email with PDF attachment
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.user,
        pass: process.env.pass,
      },
    });

    const mailOptions = {
      from: process.env.user,
      to: submission.userId,
      subject: 'Quiz Evaluation Results',
      text: 'Please find your quiz evaluation results attached as a PDF.',
      attachments: [
        {
          filename: 'Quiz_Evaluation_Results.pdf',
          path: pdfPath,
        },
      ],
    };

    await new Promise((resolve, reject) => {
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error('Error sending email:', error);
          return reject(new Error('Failed to send email'));
        }
        console.log('Email sent:', info.response);
        resolve();
      });
    });

    // Clean up PDF file
    try {
      await fsPromises.unlink(pdfPath);
    } catch (err) {
      console.warn(`Failed to delete PDF file ${pdfPath}:`, err);
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Evaluation Success</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              .fade-in {
                  animation: fadeIn 0.5s ease-in;
              }
              @keyframes fadeIn {
                  0% { opacity: 0; transform: translateY(10px); }
                  100% { opacity: 1; transform: translateY(0); }
              }
          </style>
      </head>
      <body class="bg-gray-100 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center fade-in">
              <div class="mb-4">
                  <svg class="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
              </div>
              <h2 class="text-2xl font-semibold text-gray-800 mb-2">Evaluation Complete!</h2>
              <p class="text-gray-600 mb-6">Results have been sent to the user's email as a PDF.</p>
              <a href="/admin/evaluation" class="inline-block bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition duration-200">Back to Evaluation</a>
          </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error saving evaluations:', error);
    res.status(500).send(`An error occurred while saving evaluations: ${error.message}`);
  }
});

// Admin View Evaluation Page
app.get('/admin/view-evaluation', checkAdminAuthentication, async (req, res) => {
  try {
    const { email } = req.query;
    let evaluatedSubmissions;

    if (email) {
      evaluatedSubmissions = await Submission.find({
        isEvaluated: true,
        'userId': email,
      });
    } else {
      // If no email parameter provided, fetch all evaluated submissions
      evaluatedSubmissions = await Submission.find({ isEvaluated: true });
    }

    res.render('view-evaluation', { evaluatedSubmissions, email });
  } catch (error) {
    console.error('Error fetching evaluated submissions:', error);
    res.status(500).send('An error occurred while fetching evaluated submissions.');
  }
});



// Add this route to your Express.js app
app.get('/admin/view-evaluation/:submissionId', checkAdminAuthentication, async (req, res) => {
  try {
    const submissionId = req.params.submissionId;
    const evaluatedSubmission = await Evaluated.findOne({ submissionId });
    if (!evaluatedSubmission) {
      return res.status(404).send('Evaluated submission not found.');
    }

    const submission = await Submission.findById(submissionId);
    if (!submission) {
      return res.status(404).send('Submission not found.');
    }

    const mainTopic = await MainTopic.findById(submission.mainTopicId);
    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(submission.subTopicId);
    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    const questionMap = {};
    subTopic.questions.forEach((q) => {
      questionMap[q.question] = {
        isCodingQuestion: q.isCodingQuestion,
        questionType: q.questionType,
        options: q.options,
        correctOptionIndex: q.correctOptionIndex,
        imageUrl: q.imageUrl,
      };
    });

    const enhancedEvaluations = evaluatedSubmission.evaluations.map((evaluation) => ({
      ...evaluation._doc,
      isCodingQuestion: questionMap[evaluation.question]?.isCodingQuestion || false,
      questionType: questionMap[evaluation.question]?.questionType || 'subjective',
      options: questionMap[evaluation.question]?.options || [],
      correctOptionIndex: questionMap[evaluation.question]?.correctOptionIndex,
      userOptionIndex: evaluation.userOptionIndex,
      imageUrl: questionMap[evaluation.question]?.imageUrl || null,
    }));

    const enhancedEvaluatedSubmission = {
      ...evaluatedSubmission._doc,
      evaluations: enhancedEvaluations,
    };

    res.render('view-evaluated-submission', { evaluatedSubmission: enhancedEvaluatedSubmission });
  } catch (error) {
    console.error('Error fetching evaluated submission:', error);
    res.status(500).send('An error occurred while fetching the evaluated submission.');
  }
});

app.get('/admin/settings', checkAdminAuthentication, (req, res) => {
  res.render('admin-settings');
});

app.post('/admin/update-settings', checkAdminAuthentication, async (req, res) => {
  try {
    const newUsername = req.body.newUsername;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;

    if (newPassword !== confirmPassword) {
      return res.render('admin-settings', { error: 'Passwords do not match' });
    }

    await Admin.updateOne({}, { username: newUsername, password: newPassword });

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Settings Updated</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
              .fade-in {
                  animation: fadeIn 0.5s ease-in;
              }
              @keyframes fadeIn {
                  0% { opacity: 0; transform: translateY(10px); }
                  100% { opacity: 1; transform: translateY(0); }
              }
          </style>
      </head>
      <body class="bg-gray-100 flex items-center justify-center min-h-screen">
          <div class="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center fade-in">
              <div class="mb-4">
                  <svg class="w-16 h-16 text-green-500 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                  </svg>
              </div>
              <h2 class="text-2xl font-semibold text-gray-800 mb-2">Update Successful!</h2>
              <p class="text-gray-600 mb-6">Your username and password have been updated.</p>
              <a href="/admin/dashboard" class="inline-block bg-blue-600 text-white font-medium py-2 px-6 rounded-lg hover:bg-blue-700 transition duration-200">Go to Dashboard</a>
          </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error updating admin settings:', error);
    res.status(500).send('An error occurred while updating admin settings.');
  }
});



// Add this route to your Express.js app
app.post('/logout', (req, res) => {
  // Clear the user's session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying session:', err);
    }
    // Redirect the user to the registration page after logging out
    res.redirect('/');
  });
});

// Add this route to your Express.js app
app.post('/admin/logout', (req, res) => {
  // Clear the admin's session
  req.session.destroy((err) => {
    if (err) {
      console.error('Error destroying admin session:', err);
    }
    // Redirect the admin to the login page after logging out
    res.redirect('/admin'); // You can replace '/admin' with the admin login page URL
  });
});



// Route to update a question
app.post('/admin/update-question', checkAdminAuthentication, upload.single('image'), async (req, res) => {
  const { mainTopicId, subTopicId, questionId, question, questionType, answer, timer, marks, options, correctOptionIndex } = req.body;
  const image = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const mainTopic = await MainTopic.findById(mainTopicId);
    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);
    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    const questionObj = subTopic.questions.id(questionId);
    if (!questionObj) {
      return res.status(404).send('Question not found.');
    }

    // Update question fields
    questionObj.question = question;
    questionObj.questionType = questionType;
    questionObj.timer = parseInt(timer) || 0;
    questionObj.marks = parseInt(marks) || 0;
    questionObj.isCodingQuestion = questionType === 'coding';

    if (questionType === 'mcq') {
      questionObj.options = Array.isArray(options) ? options.filter(opt => opt.trim() !== '') : [];
      questionObj.correctOptionIndex = correctOptionIndex ? parseInt(correctOptionIndex) : null;
      questionObj.answer = ''; // Ensure answer is empty for MCQs
      if (questionObj.options.length < 2 || questionObj.correctOptionIndex === null || questionObj.correctOptionIndex >= questionObj.options.length) {
        return res.status(400).send('MCQ must have at least 2 valid options and a valid correct option selected.');
      }
    } else {
      questionObj.answer = answer || '';
      questionObj.options = [];
      questionObj.correctOptionIndex = null;
      if (questionType === 'coding' && image) {
        // Delete old image if it exists
        if (questionObj.imageUrl) {
          const oldImagePath = path.join(__dirname, 'public', questionObj.imageUrl);
          try {
            await fsPromises.unlink(oldImagePath);
          } catch (err) {
            console.warn(`Failed to delete old image ${questionObj.imageUrl}:`, err);
          }
        }
        questionObj.imageUrl = image;
      } else if (questionType !== 'coding') {
        // Clear imageUrl if switching from coding to another type
        if (questionObj.imageUrl) {
          const oldImagePath = path.join(__dirname, 'public', questionObj.imageUrl);
          try {
            await fsPromises.unlink(oldImagePath);
          } catch (err) {
            console.warn(`Failed to delete old image ${questionObj.imageUrl}:`, err);
          }
          questionObj.imageUrl = null;
        }
      }
    }

    await mainTopic.save();
    res.redirect(`/admin/view-questions/${mainTopicId}/${subTopicId}`);
  } catch (error) {
    console.error('Error updating question:', error);
    res.status(500).send('An error occurred while updating the question.');
  }
});

// Route to delete a question
app.post('/admin/delete-question', checkAdminAuthentication, async (req, res) => {
  const { mainTopicId, subTopicId, questionId } = req.body;

  try {
    const mainTopic = await MainTopic.findById(mainTopicId);
    if (!mainTopic) {
      return res.status(404).json({ error: 'Main topic not found.' });
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);
    if (!subTopic) {
      return res.status(404).json({ error: 'Subtopic not found.' });
    }

    const question = subTopic.questions.id(questionId);
    if (!question) {
      return res.status(404).json({ error: 'Question not found.' });
    }

    // Delete image if it exists
    if (question.imageUrl) {
      const imagePath = path.join(__dirname, 'public', question.imageUrl);
      try {
        await fsPromises.unlink(imagePath);
      } catch (err) {
        console.warn(`Failed to delete image ${question.imageUrl}:`, err);
      }
    }

    subTopic.questions.pull(questionId);
    await mainTopic.save();
    res.status(200).json({ message: 'Question deleted successfully.' });
  } catch (error) {
    console.error('Error deleting question:', error);
    res.status(500).json({ error: 'An error occurred while deleting the question.' });
  }
});


  app.listen(3000, () => {
      console.log('Server started on port:3000');
  });