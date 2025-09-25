require('dotenv').config();
const express = require('express');
const cors = require('cors');
const apiRoutes = require('./routes/api.routes');
const { cleanupInactiveSessions } = require('./utils/context.manager');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust proxy settings - needed for proper IP detection behind nginx/reverse proxy
app.set('trust proxy', true);

// Middleware
const corsOptions = {
    origin: [
        'https://aetheria-atf-miit.vercel.app',
        'http://localhost:3000', // For local frontend development
        'http://localhost:3001', // Alternative local port
        'http://127.0.0.1:3000'  // Alternative localhost format
    ],
    credentials: true, // Allow cookies and authentication headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'Cache-Control'
    ]
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Root endpoint for health check
app.get('/', (req, res) => {
    res.send('AI Weather Chatbot Backend is running!');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});

// Set the interval for how often the cleanup task should run.
// e.g., every 5 minutes (300,000 milliseconds).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

setInterval(cleanupInactiveSessions, CLEANUP_INTERVAL_MS);

console.log(`[Session Cleanup] Inactivity cleanup job scheduled to run every ${CLEANUP_INTERVAL_MS / 60000} minutes.`);
console.log(`[Session Cleanup] Sessions will be removed after ${30 * 60 * 1000 / 60000} minutes of inactivity.`);