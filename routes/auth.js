import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/config.js';
import { sendStudentWelcomeEmail, sendMentorWelcomeEmail } from '../services/emailService.js';

const router = express.Router();

// JWT secret - should be in environment variable in production
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'; // Token expires in 7 days

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

// Helper function to calculate age from DD/MM/YYYY format
const calculateAge = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed in JavaScript
    const year = parseInt(parts[2], 10);

    const birthDate = new Date(year, month, day);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }

    return age;
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

        // Validate terms agreement
        if (agreeToTerms !== true) {
            return res.status(400).json({
                success: false,
                message: 'You must agree to the Terms of Service and Privacy Policy'
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

        // Validate password requirements
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        if (password.length > 64) {
            return res.status(400).json({
                success: false,
                message: 'Password must not exceed 64 characters'
            });
        }

        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one uppercase letter'
            });
        }

        if (!/[0-9]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one number'
            });
        }

        // Age validation - Students must be 16 or older
        const age = calculateAge(dateOfBirth);
        if (age === null) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Expected DD/MM/YYYY'
            });
        }
        if (age < 16) {
            return res.status(400).json({
                success: false,
                message: 'You must be at least 16 years old to register as a student'
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

        // Check if user already exists (before expensive password hashing)
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

        // Hash password (only after confirming user doesn't exist)
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

        // Record marketing consent history
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await pool.query(
            `INSERT INTO marketing_consent_history (
                user_id,
                consent_given,
                consent_method,
                ip_address,
                user_agent,
                source
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                newUser.id,
                agreeToMarketing || false,
                'signup',
                ipAddress,
                userAgent,
                'web_app'
            ]
        );


        // Generate JWT token and auto-authenticate user
        const token = jwt.sign(
            {
                id: newUser.id,
                email: newUser.email,
                userType: newUser.user_type
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set token in httpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

        // Send welcome email (non-blocking - don't wait for email to send)
        sendStudentWelcomeEmail({
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            email: newUser.email
        }).catch(error => {
            console.error('Failed to send welcome email, but registration succeeded:', error);
        });

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

// Mentor Registration Route
router.post('/register/mentor', async (req, res) => {
    const {
        // Step 1: Basic Info
        firstName,
        lastName,
        email,
        password,
        phone,
        dateOfBirth,
        // Step 2: Professional Info
        occupationArea,
        currentPosition,
        company,
        yearsOfExperience,
        university,
        faculty,
        // Step 3: Mentoring Info
        bio,
        linkedin,
        photoUrl,
        // Agreements
        agreeToTerms,
        agreeToMarketing
    } = req.body;

    try {
        // Validate required fields from Step 1
        if (!firstName || !lastName || !email || !password || !phone || !dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required basic information'
            });
        }

        // Validate required fields from Step 2
        if (!occupationArea || !currentPosition || !university || !faculty) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required professional information'
            });
        }

        // Validate required fields from Step 3
        if (!bio) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a bio'
            });
        }

        // Validate terms agreement
        if (agreeToTerms !== true) {
            return res.status(400).json({
                success: false,
                message: 'You must agree to the Terms of Service and Privacy Policy'
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

        // Validate password requirements
        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        if (password.length > 64) {
            return res.status(400).json({
                success: false,
                message: 'Password must not exceed 64 characters'
            });
        }

        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one uppercase letter'
            });
        }

        if (!/[0-9]/.test(password)) {
            return res.status(400).json({
                success: false,
                message: 'Password must contain at least one number'
            });
        }

        // Age validation - Mentors must be 18 or older
        const age = calculateAge(dateOfBirth);
        if (age === null) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date format. Expected DD/MM/YYYY'
            });
        }
        if (age < 18) {
            return res.status(400).json({
                success: false,
                message: 'You must be at least 18 years old to register as a mentor'
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

        // Check if user already exists (before expensive password hashing)
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

        // Hash password (only after confirming user doesn't exist)
        const hashedPassword = await bcrypt.hash(password, 10);

        // Start transaction
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Insert new user with type 'mentor'
            const userResult = await client.query(
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
                    'mentor',
                    agreeToTerms || false,
                    agreeToMarketing || false
                ]
            );

            const newUser = userResult.rows[0];

            // Insert mentor details with default 'pending' application status
            await client.query(
                `INSERT INTO mentor_details (
                    user_id,
                    occupation_area,
                    current_position,
                    company,
                    years_of_experience,
                    university,
                    faculty,
                    bio,
                    linkedin,
                    photo_url,
                    application_status
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    newUser.id,
                    occupationArea,
                    currentPosition,
                    company || null,
                    yearsOfExperience || null,
                    university,
                    faculty,
                    bio,
                    linkedin || null,
                    photoUrl || null,
                    'pending' // New mentors start with pending status
                ]
            );

            // Record marketing consent history
            const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'];

            await client.query(
                `INSERT INTO marketing_consent_history (
                    user_id,
                    consent_given,
                    consent_method,
                    ip_address,
                    user_agent,
                    source
                ) VALUES ($1, $2, $3, $4, $5, $6)`,
                [
                    newUser.id,
                    agreeToMarketing || false,
                    'signup',
                    ipAddress,
                    userAgent,
                    'web_app'
                ]
            );

            await client.query('COMMIT');

            // Generate JWT token and auto-authenticate user
            const token = jwt.sign(
                {
                    id: newUser.id,
                    email: newUser.email,
                    userType: newUser.user_type
                },
                JWT_SECRET,
                { expiresIn: JWT_EXPIRES_IN }
            );

            // Set token in httpOnly cookie
            res.cookie('token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
            });

            // Send welcome email (non-blocking - don't wait for email to send)
            sendMentorWelcomeEmail({
                firstName: newUser.first_name,
                lastName: newUser.last_name,
                email: newUser.email
            }).catch(error => {
                console.error('Failed to send welcome email, but registration succeeded:', error);
            });

            res.status(201).json({
                success: true,
                message: 'Mentor registration successful',
                user: {
                    id: newUser.id,
                    firstName: newUser.first_name,
                    lastName: newUser.last_name,
                    email: newUser.email,
                    userType: newUser.user_type,
                    createdAt: newUser.created_at
                }
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Mentor registration error:', error);
        res.status(500).json({
            success: false,
            message: 'Registration failed. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Login Route
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        // Validate required fields
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            });
        }

        // Find user by email
        const userResult = await pool.query(
            'SELECT id, first_name, last_name, email, password, user_type, phone, country_code FROM users WHERE email = $1',
            [email.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        const user = userResult.rows[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: user.id,
                email: user.email,
                userType: user.user_type
            },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES_IN }
        );

        // Set token in httpOnly cookie
        res.cookie('token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
        });

        // Return user data (without password)
        res.json({
            success: true,
            message: 'Login successful',
            user: {
                id: user.id,
                first_name: user.first_name,
                last_name: user.last_name,
                email: user.email,
                user_type: user.user_type,
                phone: user.phone,
                country_code: user.country_code
            }
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed. Please try again later.',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Check auth status - verify JWT from cookie
router.get('/me', async (req, res) => {
    try {
        // Get token from cookie
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        // Verify token
        const decoded = jwt.verify(token, JWT_SECRET);

        // Fetch user data from database
        const userResult = await pool.query(
            'SELECT id, first_name, last_name, email, user_type, phone, country_code FROM users WHERE id = $1',
            [decoded.id]
        );

        if (userResult.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        const user = userResult.rows[0];

        // Return user data
        res.json({
            success: true,
            id: user.id,
            first_name: user.first_name,
            last_name: user.last_name,
            email: user.email,
            user_type: user.user_type,
            phone: user.phone,
            country_code: user.country_code
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        console.error('Auth check error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication check failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Logout Route - clear JWT cookie
router.post('/logout', async (req, res) => {
    try {
        // Clear the token cookie
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
        });

        res.json({
            success: true,
            message: 'Logout successful'
        });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
