const express =  require('express');
const multer = require('multer');
const path = require('path');
const nodemailer = require('nodemailer');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Verify environment variables
console.log('Environment check:');
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'Set' : 'Not set');
console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'Set' : 'Not set');

// Add body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure CORS for production
app.use(cors({
    origin: process.env.FRONTEND_URL || '*',
    methods: ['GET', 'POST'],
    credentials: true
}));

app.use(express.static(path.join(__dirname)));

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads')
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    },
});

// File filter to only allow images and PDFs
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only images and PDFs are allowed!'), false);
    }
};

const upload = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    }
});

app.use(express.static(__dirname));

// Email configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Test email configuration
transporter.verify(function(error, success) {
    if (error) {
        console.log('Email configuration error:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Received upload request');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);

    if (!req.file) {
        console.log('No file uploaded');
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    const { name, email } = req.body;
    if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required.' });
    }

    const filePath = req.file.path;

    try {
        console.log('Preparing to send email');
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: process.env.EMAIL_USER,
            subject: 'New File Upload',
            text: `Name: ${name}\nEmail: ${email}\nFile: ${req.file.originalname}`,
            attachments: [{
                filename: req.file.originalname,
                path: filePath
            }]
        };

        console.log('Sending email...');
        await transporter.sendMail(mailOptions);
        console.log('Email sent successfully');
        
        // Clean up: Delete the file after sending
        fs.unlinkSync(filePath);
        console.log('Temporary file deleted');
        
        return res.status(200).json({ message: 'File uploaded and email sent successfully!' });
    } catch (error) {
        console.error('Error details:', error);
        // Don't delete the file if there was an error
        return res.status(500).json({ message: 'Error sending email: ' + error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ message: 'File size too large. Maximum size is 5MB.' });
        }
        return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: 'Something went wrong: ' + err.message });
});

// Handle 404 errors
app.use((req, res) => {
    console.log('404 - Route not found:', req.url);
    return res.status(404).json({ message: 'Route not found' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log('Email configuration:', {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS ? 'Password is set' : 'Password is missing'
    });
});