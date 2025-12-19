import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth_new.js';
import mentorsRoutes from './routes/mentors.js';
import dashboardRoutes from './routes/dashboard.js';
import bookingsRoutes from './routes/bookings.js';
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? process.env.FRONTEND_URL : "http://localhost:5173",   // allow your frontend
    credentials: true
}));
// Middleware
app.use(express.json());
app.use(cookieParser());

// Serve static files (PDF documents)
app.use('/api/documents', express.static('public/documents'));

// Simple route
app.get('/', (req, res) => {
    res.json({ message: 'Z-Academy API Server' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/mentors', mentorsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/bookings', bookingsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);

    // Handle Multer file upload errors
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: 'File size too large. Maximum size is 8MB.'
            });
        }
        return res.status(400).json({
            success: false,
            message: 'File upload error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }

    // Handle custom file type errors
    if (err.message && err.message.includes('Invalid file type')) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    res.status(500).json({
        success: false,
        message: 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});