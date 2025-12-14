// Data Access Layer for User operations
import pool from '../db/config.js';

/**
 * Find user by email
 */
export const findUserByEmail = async (email) => {
    const result = await pool.query(
        'SELECT id, first_name, last_name, email, password, user_type, phone, country_code FROM users WHERE email = $1',
        [email.toLowerCase()]
    );
    return result.rows[0] || null;
};

/**
 * Find user by ID
 */
export const findUserById = async (userId) => {
    const result = await pool.query(
        'SELECT id, first_name, last_name, email, user_type, phone, country_code FROM users WHERE id = $1',
        [userId]
    );
    return result.rows[0] || null;
};

/**
 * Check if user exists by email
 */
export const userExistsByEmail = async (email) => {
    const result = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
    );
    return result.rows.length > 0;
};

/**
 * Create a student user
 */
export const createStudent = async (userData) => {
    const {
        firstName,
        lastName,
        email,
        hashedPassword,
        phone,
        dateOfBirth,
        agreeToTerms,
        agreeToMarketing
    } = userData;

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
            dateOfBirth,
            'user',
            agreeToTerms || false,
            agreeToMarketing || false
        ]
    );

    return result.rows[0];
};

/**
 * Create a mentor user with mentor details (transaction)
 */
export const createMentor = async (userData, mentorDetails) => {
    const {
        firstName,
        lastName,
        email,
        hashedPassword,
        phone,
        dateOfBirth,
        agreeToTerms,
        agreeToMarketing
    } = userData;

    const {
        occupationArea,
        currentPosition,
        company,
        yearsOfExperience,
        university,
        faculty,
        bio,
        linkedin,
        photoUrl
    } = mentorDetails;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Insert user
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
                dateOfBirth,
                'mentor',
                agreeToTerms || false,
                agreeToMarketing || false
            ]
        );

        const newUser = userResult.rows[0];

        // Insert mentor details
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
                'pending'
            ]
        );

        await client.query('COMMIT');
        return newUser;

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Record marketing consent history
 */
export const recordMarketingConsent = async (userId, consentData) => {
    const {
        consentGiven,
        consentMethod,
        ipAddress,
        userAgent,
        source,
        campaignId,
        notes
    } = consentData;

    await pool.query(
        `INSERT INTO marketing_consent_history (
            user_id,
            consent_given,
            consent_method,
            ip_address,
            user_agent,
            source,
            campaign_id,
            notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
            userId,
            consentGiven,
            consentMethod,
            ipAddress,
            userAgent,
            source,
            campaignId || null,
            notes || null
        ]
    );
};
