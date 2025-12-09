import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Middleware to verify JWT and extract user
export const authenticateUser = (req, res, next) => {
    try {
        const token = req.cookies.token;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: 'Invalid or expired token'
        });
    }
};

// Middleware to check if user is a mentor
export const requireMentor = (req, res, next) => {
    if (req.user.userType !== 'mentor') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Mentor only.'
        });
    }
    next();
};

// Middleware to check if user is a student
export const requireStudent = (req, res, next) => {
    if (req.user.userType !== 'user') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Student only.'
        });
    }
    next();
};
