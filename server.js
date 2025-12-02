const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const prisma = require('./lib/prisma');

const app = express();
const port = process.env.PORT || 3001;

// Middleware

app.use(express.json());

app.use(cors({
    origin: function (origin, callback) {
        console.log("REQUEST ORIGIN:", origin);
        console.log("ENV CLIENT_URL:", process.env.CLIENT_URL);

        const allowed = [
            "http://localhost:3000",
            "https://booksalon.vercel.app"
        ];

        if (!origin || allowed.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Blocked by CORS"));
        }
    },
    credentials: true
}));

// Serve static files (uploaded images)
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
const authRoutes = require('./routes/authRoutes');
const businessRoutes = require('./routes/businessRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const staffRoutes = require('./routes/staffRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes); // Mount upload routes at /api to support /businesses and /staff paths
app.use('/api/businesses', businessRoutes); // Then business routes
app.use('/api', serviceRoutes);
app.use('/api', staffRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api', reviewRoutes);

app.get('/', async (req, res) => {
    try {
        await prisma.$connect();
        res.send('Fresha Clone API is running and connected to DB');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error connecting to DB: ' + error.message);
    }
});

// Global Error Handler
app.use((err, req, res, next) => {
    console.error('Global Error:', err);

    // Handle Multer errors
    if (err.name === 'MulterError') {
        return res.status(400).json({
            message: 'File upload error',
            error: err.message
        });
    }

    // Handle other errors
    res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
