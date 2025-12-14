// Validation middleware for authentication routes

// Helper function to convert DD/MM/YYYY to YYYY-MM-DD for PostgreSQL
const convertDateFormat = (dateString) => {
    if (!dateString) return null;
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;
    const [day, month, year] = parts;
    // Handle 2-digit or 4-digit year
    const fullYear = year.length === 2 ? (parseInt(year) < 50 ? '20' + year : '19' + year) : year;
    return `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
};

// Helper function to calculate age from DD/MM/YYYY format
const calculateAge = (dateString) => {
    const parts = dateString.split('/');
    if (parts.length !== 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
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

/**
 * Validate email format
 */
const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

/**
 * Validate password requirements
 */
const validatePassword = (password) => {
    const errors = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters long');
    }

    if (password.length > 64) {
        errors.push('Password must not exceed 64 characters');
    }

    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return errors;
};

/**
 * Validate student registration data
 */
export const validateStudentRegistration = (req, res, next) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phone,
        dateOfBirth,
        agreeToTerms
    } = req.body;

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
    if (!validateEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
        });
    }

    // Validate password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({
            success: false,
            message: passwordErrors[0]
        });
    }

    // Validate age - Students must be 16 or older
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

    // Convert date format
    const formattedDate = convertDateFormat(dateOfBirth);
    if (!formattedDate) {
        return res.status(400).json({
            success: false,
            message: 'Invalid date format. Expected DD/MM/YYYY'
        });
    }

    // Attach formatted date to request for use in service layer
    req.formattedDate = formattedDate;

    next();
};

/**
 * Validate mentor registration data
 */
export const validateMentorRegistration = (req, res, next) => {
    const {
        firstName,
        lastName,
        email,
        password,
        phone,
        dateOfBirth,
        occupationArea,
        currentPosition,
        university,
        faculty,
        bio,
        agreeToTerms
    } = req.body;

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
    if (!validateEmail(email)) {
        return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
        });
    }

    // Validate password
    const passwordErrors = validatePassword(password);
    if (passwordErrors.length > 0) {
        return res.status(400).json({
            success: false,
            message: passwordErrors[0]
        });
    }

    // Validate age - Mentors must be 18 or older
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

    // Convert date format
    const formattedDate = convertDateFormat(dateOfBirth);
    if (!formattedDate) {
        return res.status(400).json({
            success: false,
            message: 'Invalid date format. Expected DD/MM/YYYY'
        });
    }

    // Attach formatted date to request for use in service layer
    req.formattedDate = formattedDate;

    next();
};

/**
 * Validate login data
 */
export const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: 'Please provide email and password'
        });
    }

    next();
};
