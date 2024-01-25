const express = require('express');
const app = express();
const fs = require('fs');
const session = require('express-session');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.DB_URL;

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



mongoose.connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("Connected to MongoDB");

    // Create an index on the 'email' field to improve query performance
    User.collection.createIndex({ email: 1 });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });

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
        _id: mongoose.Schema.Types.ObjectId, // Unique ID for the sub-topic
        description: String
      }
    ],
    questions: [
      {
        subTopicId: mongoose.Schema.Types.ObjectId, // Reference to the sub-topic's _id
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
  questions: [QuestionSchema] // Array of questions
});
  
  const MainTopicSchema = new mongoose.Schema({
    mainTopic: String,
    subTopics: [SubTopicSchema] // Array of subtopics
  });
  
  const MainTopic = mongoose.model('MainTopic', MainTopicSchema);
  
  module.exports = { MainTopic };
  
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
      default: false, // Set the default value to false
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
      type: String, // Assuming the user's email is a string
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
      adminAnswer: String, // Added field for admin's answer
      adminEvaluation: [String],
    }],
    totalMarksSecured: Number,
    evaluationDate: {
      type: Date,
      default: Date.now // Set the default date to the current date and time
    }
  });
  
  const Evaluated = mongoose.model('Evaluated', evaluatedSchema);
  
  const adminSchema = new mongoose.Schema({
    username: String,
    password: String,
  });
  
  const Admin = mongoose.model('Admin', adminSchema);

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


app.post('/admin/save-questions', async (req, res) => {
  const { mainTopicId, subTopicId, questions, answers, timers, marks } = req.body;

  try {
    const mainTopic = await MainTopic.findById(mainTopicId);

    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);

    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    // Initialize the 'questions' property if it doesn't exist
    if (!subTopic.questions) {
      subTopic.questions = [];
    }

    // Iterate through the arrays and create question objects
    for (let i = 0; i < questions.length; i++) {
      // Check if the question already exists in any subtopics
      const isQuestionDuplicate = mainTopic.subTopics.some((sub) =>
        sub.questions.some((q) => q.question === questions[i])
      );

      if (isQuestionDuplicate) {
        // Display an alert to the admin and prevent adding the duplicate question
        return res.send('<script>alert("Question already exists in another subtopic or main topic."); window.location="/admin/add-questions/:mainTopicId/:subTopicId";</script>');
      }

      subTopic.questions.push({
        question: questions[i],
        answer: answers[i],
        timer: timers[i],
        marks: marks[i],
      });
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

    // Calculate the total timer duration for all questions in this subtopic
    const totalTimerDuration = subTopic.questions.reduce((total, question) => total + question.timer, 0);

    // Render the view-questions.ejs template and pass the subtopic and totalTimerDuration
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


app.get('/quiz/:mainTopicId/:subTopicId',checkAuthentication, async (req, res) => {
  try {
    const { mainTopicId, subTopicId } = req.params;

    // console.log('mainTopicId:', mainTopicId);
    // console.log('subTopicId:', subTopicId);

    // Fetch the main topic and subtopic details from your database
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

    // Retrieve tpropertiehe questions for the selected subtopic
    const questions = subTopic.questions;

    // Create a 'quiz' object with the necessary properties
    const quiz = {
      mainTopicId: mainTopicId, // Pass the mainTopicId
      subTopicId: subTopicId, // Pass the subTopicId
      title: mainTopic.mainTopic, // You can customize this as needed
      description: subTopic.subTopic, // You can customize this as needed
      questions: questions, // Ensure that 'questions' property is correctly assigned
      totalTimerDuration: totalTimerDuration, // Pass the totalTimerDuration to the quiz page
      mainTopic: mainTopic,
      subTopic: subTopic,
    };

    // Check if the user is already taking a quiz
    const userId = req.session.email; // Assuming email is a unique identifier for users
    const isUserTakingQuiz = !!activeQuizSessions[userId];
    let formSubmitted = false;

    // Render the quiz page (quiz1.ejs) and pass the 'quiz' object along with 'questions' and other data
    res.render('quiz', { quiz, isUserTakingQuiz, userId, formSubmitted }); // Pass isUserTakingQuiz here
  } catch (error) {
    console.error('Error fetching subtopic:', error);
    res.status(500).send('An error occurred while fetching the subtopic.');
  }
});

app.post('/submit', async (req, res) => {
  const userId = req.session.email; // Assuming you're using the email as a unique identifier for the user
  const { mainTopicId, subTopicId, userAnswers, marks} = req.body;
  console.log('firstName after quiz submission:', req.session.firstName);

  try {
    // Fetch the main topic and subtopic details from your database
    const mainTopic = await MainTopic.findById(mainTopicId);

    if (!mainTopic) {
      return res.status(404).send('Main topic not found.');
    }

    const subTopic = mainTopic.subTopics.id(subTopicId);

    if (!subTopic) {
      return res.status(404).send('Subtopic not found.');
    }

    // Ensure that 'questions' property is correctly assigned in subTopic
    const questions = subTopic.questions;

    // Create an array to store the user's answers along with admin questions and answers
    const submissionData = [];

    // Iterate through the questions, combining user answers with admin questions and answers
    for (let i = 0; i < questions.length; i++) {
      submissionData.push({
        question: questions[i].question,
        adminAnswer: questions[i].answer,
        userAnswer: userAnswers[i],
        marks: questions[i].marks,
      });
    }

    // Create a new submission in the database
    await Submission.create({
      userId: userId,
      mainTopicId: mainTopicId,
      subTopicId: subTopicId,
      mainTopicName: mainTopic.mainTopic, // Store the main topic name
      subTopicName: subTopic.subTopic,    // Store the sub topic name
      questions: submissionData,
    });

    // Remove the quiz session from activeQuizSessions
  delete activeQuizSessions[userId];

  res.send(`
  <div style="font-size: 20px;">
    <p>Successfully submitted the quiz! Wait for the results via email.</p>
    <a href="/homepage">Back to Homepage</a>
  </div>
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
    
    // Retrieve the submission data based on the submissionId from the database
    const submission = await Submission.findById(submissionId);
    
    if (!submission) {
      return res.status(404).send('Submission not found.');
    }

    const evaluations = [];

    // Render the evaluation form (evaluation-form.ejs) and pass the submission data
    res.render('evaluation-form', { submission, evaluations });
  } catch (error) {
    console.error('Error fetching submission for evaluation:', error);
    res.status(500).send('An error occurred while fetching the submission.');
  }
});

app.post('/admin/evaluate/:submissionId/submit', async (req, res) => {
  const submissionId = req.params.submissionId;
  const evaluations = req.body.evaluations; // This will contain the evaluations for each question
  // const evaluationData = req.body.evaluations;
  const totalMarksSecured = parseInt(req.body.totalMarksSecured); // New input field for Total Marks Secured
  
  try {
    // Fetch the submission from the database using the submissionId
    const submission = await Submission.findById(submissionId);

    if (!submission) {
      return res.status(404).send('Submission not found.');
    }

    // Create an array to store the evaluated data
    const evaluatedData = [];

    // Iterate through the questions and add evaluated data for each question
    submission.questions.forEach((question, index) => {
      evaluatedData.push({
        question: question.question,
        adminAnswer: question.adminAnswer,
        userAnswer: question.userAnswer,
        adminEvaluation: evaluations[index], // Admin's evaluation for the question
      });
    });

    
    // Create a new "Evaluated" document and save it to the database
    await Evaluated.create({
      submissionId: submissionId,
      userId: submission.userId, // User's email
      mainTopicName: submission.mainTopicName,
      subTopicName: submission.subTopicName,
      evaluations: evaluatedData,
      totalMarksSecured: totalMarksSecured,
    });

    // Inside the /admin/evaluate/:submissionId/submit route handler
await Submission.findByIdAndUpdate(submissionId, { isEvaluated: true });


const emailContent = `
<h1>Quiz Evaluation Results</h1>
<p>Here are the evaluated results for your submission:</p>
<table border="1">
  <tr>
    <th>Question</th>
    <th>Your Answer</th>
    <th>Allotted Marks</th>
    <th>Marks Secured</th>
  </tr>
  ${submission.questions.map((question, index) => `
    <tr>
      <td>${question.question}</td>
      <td>${question.userAnswer}</td>
      <td>${question.marks}</td>
      <td>${evaluations[index]}</td>
    </tr>
  `).join('')}
  <tr>
  <td colspan="3">Total Marks Secured:</td>
  <td>${totalMarksSecured}</td>
</tr>
</table>
`;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'pavankalyan.yes@gmail.com',
        pass: 'hwcfukpoewkcwlha',
      },
    });
    
    const mailOptions = {
      from: 'pavankalyan.yes@gmail.com', // Replace with your email address
      to: submission.userId, // User's registered email address
      subject: 'Quiz Evaluation Results',
      html: emailContent,
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error('Error sending email:', error);
        res.status(500).send('An error occurred while sending the email.');
      } else {
        console.log('Email sent:', info.response);
        res.send(`
  <div style="font-size: 20px;">
    <p>Evaluated successfully! Results sent via email</p>
    <a href="/admin/evaluation">Back to evaluation</a>
  </div>
`);
      }
    });
  } catch (error) {
    console.error('Error saving evaluations:', error);
    res.status(500).send('An error occurred while saving evaluations.');
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

    // Fetch the evaluated submission details from the database based on submissionId
    const evaluatedSubmission = await Evaluated.findOne({ submissionId });

    if (!evaluatedSubmission) {
      return res.status(404).send('Evaluated submission not found.');
    }

    // Render a template to display the evaluated submission details
    res.render('view-evaluated-submission', { evaluatedSubmission });
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
    // Retrieve the new username and password from the form submission
    const newUsername = req.body.newUsername;
    const newPassword = req.body.newPassword;
    const confirmPassword = req.body.confirmPassword;

    // Check if newPassword matches confirmPassword
    if (newPassword !== confirmPassword) {
      // Passwords don't match, handle this error as needed
      return res.render('admin-settings', { error: 'Passwords do not match' });
    }

    // Update the admin credentials in the database
    await Admin.updateOne({}, { username: newUsername, password: newPassword });
    
    // Construct a success message with a link to the dashboard
    const successMessage = `
    <div style="font-size:20px;">
      <p>Successfully updated the username and password!</p>
      <a href="/admin/dashboard">Go to dashboard</a>
      </div>
    `;
    
    res.send(successMessage);


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


  app.listen(3000, () => {
      console.log('Server started on port:3000');
  });