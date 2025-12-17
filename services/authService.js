// Business logic for authentication
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db/config.js';
import {
    userExistsByEmail,
    createStudent,
    createMentor,
    recordMarketingConsent,
    findUserByEmail,
    findUserById
} from '../dal/userDal.js';
import { sendStudentWelcomeEmail, sendMentorWelcomeEmail } from './emailService.js';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt-secret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Generate JWT token for user
 */
const generateToken = (user) => {
    return jwt.sign(
        {
            id: user.id,
            email: user.email,
            userType: user.user_type
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
};

/**
 * Get client metadata from request
 */
const getClientMetadata = (req) => {
    return {
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent']
    };
};

/**
 * Register a new student
 */
export const registerStudent = async (data, req) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phone,
        agreeToTerms,
        agreeToMarketing
    } = data;

    const formattedDate = req.formattedDate;

    // Check if user already exists
    const exists = await userExistsByEmail(email);
    if (exists) {
        throw new Error('An account with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create student user
        const newUser = await createStudent({
            firstName,
            lastName,
            email,
            hashedPassword,
            phone,
            dateOfBirth: formattedDate,
            agreeToTerms,
            agreeToMarketing
        }, client);

        // Record marketing consent history
        const clientMetadata = getClientMetadata(req);
        await recordMarketingConsent(newUser.id, {
            consentGiven: agreeToMarketing || false,
            consentMethod: 'signup',
            ipAddress: clientMetadata.ipAddress,
            userAgent: clientMetadata.userAgent,
            source: 'web_app'
        }, client);

        await client.query('COMMIT');

        // Generate JWT token
        const token = generateToken(newUser);

        // Send welcome email (non-blocking)
        sendStudentWelcomeEmail({
            firstName: newUser.first_name,
            lastName: newUser.last_name,
            email: newUser.email
        }).catch(error => {
            console.error('Failed to send welcome email, but registration succeeded:', error);
        });

        return {
            user: newUser,
            token
        };

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Register a new mentor
 */
export const registerMentor = async (data, req) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phone,
        occupationArea,
        currentPosition,
        company,
        yearsOfExperience,
        university,
        faculty,
        bio,
        linkedin,
        photoUrl,
        agreeToTerms,
        agreeToMarketing
    } = data;

    const formattedDate = req.formattedDate;

    // Check if user already exists
    const exists = await userExistsByEmail(email);
    if (exists) {
        throw new Error('An account with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Prepare marketing consent data
    const clientMetadata = getClientMetadata(req);
    const consentData = {
        consentGiven: agreeToMarketing || false,
        consentMethod: 'signup',
        ipAddress: clientMetadata.ipAddress,
        userAgent: clientMetadata.userAgent,
        source: 'web_app'
    };

    // Create mentor user with mentor details and marketing consent (all in one transaction)
    const newUser = await createMentor(
        {
            firstName,
            lastName,
            email,
            hashedPassword,
            phone,
            dateOfBirth: formattedDate,
            agreeToTerms,
            agreeToMarketing
        },
        {
            occupationArea,
            currentPosition,
            company,
            yearsOfExperience,
            university,
            faculty,
            bio,
            linkedin,
            photoUrl
        },
        consentData
    );

    // Generate JWT token
    const token = generateToken(newUser);

    // Send welcome email (non-blocking)
    sendMentorWelcomeEmail({
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        email: newUser.email
    }).catch(error => {
        console.error('Failed to send welcome email, but registration succeeded:', error);
    });

    return {
        user: newUser,
        token
    };
};

/**
 * Login user
 */
export const loginUser = async (email, password) => {
    // Find user by email
    const user = await findUserByEmail(email.toLowerCase());

    if (!user) {
        throw new Error('Invalid email or password');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
        throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(user);

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;
    return { user: userWithoutPassword, token };
};

/**
 * Verify JWT token and get user data
 */
export const verifyToken = async (token) => {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Fetch fresh user data from database
    const user = await findUserById(decoded.id);

    if (!user) {
        throw new Error('User not found');
    }

    return user;
};
