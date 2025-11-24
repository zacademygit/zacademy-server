import express from 'express';
import bcrypt from 'bcrypt';
import pool from '../db/config.js';

const router = express.Router();

// Helper function to convert DD/MM/YYYY to YYYY-MM-DD for PostgreSQL
const convertDateFormat = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    // Handle 2-digit or 4-digit year (e.g., 98 -> 1998, 1998 -> 1998)
    const fullYear = year.length === 2 ? `19${year}` : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// User Registration Route
router.post('/register/user', async (req, res) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phone,
        dateOfBirth,
        agreeToTerms,
        agreeToMarketing
    } = req.body;

    try {
        // Validate required fields
        if (!firstName || !lastName || !email || !password || !phone || !dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Validate password length
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Convert date format from DD/MM/YYYY to YYYY-MM-DD
        const formattedDate = convertDateFormat(dateOfBirth);
        if (!formattedDate) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Expected DD/MM/YYYY'
            });
        }

        // Check if user already exists
        const userCheck = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userCheck.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const result = await pool.query(
            `INSERT INTO users (
                first_name,
                last_name,
                email,
                password,
                phone,
                date_of_birth,
                user_type,
                agree_to_terms,
                agree_to_marketing
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id, first_name, last_name, email, user_type, created_at`,
            [
                firstName,
                lastName,
                email.toLowerCase(),
                hashedPassword,
                phone,
                formattedDate,
                'user',
                agreeToTerms || false,
                agreeToMarketing || false
            ]
        );

        const newUser = result.rows[0];

        res.status(201).json({
            success: true,
            message: 'Registration successful',
            user: {
                id: newUser.id,
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                email: newUser.email,
                userType: newUser.user_type,
                createdAt: newUser.created_at
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Mentor Registration Route (placeholder for future implementation)
router.post('/register/mentor', async (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Mentor registration not yet implemented'
    });
});

// Login Route (placeholder)
router.post('/login', async (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Login route not yet implemented'
    });
});

// Check auth status (placeholder)
router.get('/me', async (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Auth check not yet implemented'
    });
});

// Logout Route (placeholder)
router.post('/logout', async (req, res) => {
    res.status(501).json({
        success: false,
        message: 'Logout route not yet implemented'
    });
});

export default router;
