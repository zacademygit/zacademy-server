import express from 'express';
import pool from '../db/config.js';

const router = express.Router();

// Get unique filter options for dropdowns - MUST be before /:id route
router.get('/filter-options', async (req, res) => {
    try {
        // Get distinct occupation areas
        const occupationsQuery = `
            SELECT DISTINCT occupation_area
            FROM mentor_details
            WHERE occupation_area IS NOT NULL
            ORDER BY occupation_area
        `;
        const occupations = await pool.query(occupationsQuery);

        // Get distinct universities
        const universitiesQuery = `
            SELECT DISTINCT university
            FROM mentor_details
            WHERE university IS NOT NULL
            ORDER BY university
        `;
        const universities = await pool.query(universitiesQuery);

        // Get distinct companies
        const companiesQuery = `
            SELECT DISTINCT company
            FROM mentor_details
            WHERE company IS NOT NULL AND company != ''
            ORDER BY company
        `;
        const companies = await pool.query(companiesQuery);

        // Get distinct years of experience
        const experienceQuery = `
            SELECT DISTINCT years_of_experience
            FROM mentor_details
            WHERE years_of_experience IS NOT NULL
            ORDER BY years_of_experience
        `;
        const experience = await pool.query(experienceQuery);

        // Get distinct positions
        const positionsQuery = `
            SELECT DISTINCT current_position
            FROM mentor_details
            WHERE current_position IS NOT NULL
            ORDER BY current_position
        `;
        const positions = await pool.query(positionsQuery);

        // Get distinct faculties
        const facultiesQuery = `
            SELECT DISTINCT faculty
            FROM mentor_details
            WHERE faculty IS NOT NULL
            ORDER BY faculty
        `;
        const faculties = await pool.query(facultiesQuery);

        res.json({
            success: true,
            filterOptions: {
                occupations: occupations.rows.map(row => row.occupation_area),
                universities: universities.rows.map(row => row.university),
                companies: companies.rows.map(row => row.company),
                yearsOfExperience: experience.rows.map(row => row.years_of_experience),
                positions: positions.rows.map(row => row.current_position),
                faculties: faculties.rows.map(row => row.faculty)
            }
        });

    } catch (error) {
        console.error('Error fetching filter options:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch filter options',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get single mentor by ID - MUST be after /filter-options route
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const mentorQuery = `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                md.occupation_area,
                md.current_position,
                md.company,
                md.years_of_experience,
                md.university,
                md.faculty,
                md.bio,
                md.linkedin,
                md.photo_url,
                md.created_at
            FROM users u
            INNER JOIN mentor_details md ON u.id = md.user_id
            WHERE u.id = $1 AND u.user_type = 'mentor'
        `;

        const result = await pool.query(mentorQuery, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor not found'
            });
        }

        const mentor = result.rows[0];

        // Format response
        const mentorData = {
            id: mentor.id,
            firstName: mentor.first_name,
            lastName: mentor.last_name,
            email: mentor.email,
            occupationArea: mentor.occupation_area,
            currentPosition: mentor.current_position,
            company: mentor.company,
            yearsOfExperience: mentor.years_of_experience,
            university: mentor.university,
            faculty: mentor.faculty,
            bio: mentor.bio,
            linkedin: mentor.linkedin,
            photoUrl: mentor.photo_url,
            createdAt: mentor.created_at
        };

        res.json({
            success: true,
            data: mentorData
        });

    } catch (error) {
        console.error('Error fetching mentor:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch mentor',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get mentor availability by ID - Public endpoint
router.get('/:id/availability', async (req, res) => {
    try {
        const { id } = req.params;

        // First verify mentor exists
        const mentorCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND user_type = $2',
            [id, 'mentor']
        );

        if (mentorCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor not found'
            });
        }

        // Get availability
        const availabilityQuery = `
            SELECT
                id,
                mentor_id,
                timezone,
                schedule,
                created_at,
                updated_at
            FROM mentor_availability
            WHERE mentor_id = $1
        `;

        const result = await pool.query(availabilityQuery, [id]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                data: null,
                message: 'No availability set for this mentor'
            });
        }

        const availability = result.rows[0];

        const availabilityData = {
            id: availability.id,
            mentorId: availability.mentor_id,
            timezone: availability.timezone,
            schedule: availability.schedule,
            createdAt: availability.created_at,
            updatedAt: availability.updated_at
        };

        res.json({
            success: true,
            data: availabilityData
        });

    } catch (error) {
        console.error('Error fetching mentor availability:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch availability',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get mentor services by ID - Public endpoint
router.get('/:id/services', async (req, res) => {
    try {
        const { id } = req.params;

        // First verify mentor exists
        const mentorCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND user_type = $2',
            [id, 'mentor']
        );

        if (mentorCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor not found'
            });
        }

        // Get services
        const servicesQuery = `
            SELECT
                id,
                mentor_id,
                mentorship_service,
                mentor_session_price,
                platform_fee,
                taxes_fee,
                total_price,
                created_at,
                updated_at
            FROM mentor_services
            WHERE mentor_id = $1
            ORDER BY created_at DESC
        `;

        const result = await pool.query(servicesQuery, [id]);

        // Format response with camelCase
        const services = result.rows.map(service => ({
            id: service.id,
            mentorId: service.mentor_id,
            mentorshipService: service.mentorship_service,
            mentorSessionPrice: service.mentor_session_price,
            platformFee: service.platform_fee,
            taxesFee: service.taxes_fee,
            totalPrice: service.total_price,
            createdAt: service.created_at,
            updatedAt: service.updated_at
        }));

        res.json({
            success: true,
            data: services
        });

    } catch (error) {
        console.error('Error fetching mentor services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch services',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get all mentors with pagination and filtering
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = '',
            occupation = '',
            company = '',
            yearsOfExperience = '',
            position = '',
            university = '',
            faculty = ''
        } = req.query;

        const offset = (parseInt(page) - 1) * parseInt(limit);

        // Build WHERE clause for filters
        let whereConditions = ["u.user_type = 'mentor'"];
        let queryParams = [];
        let paramCounter = 1;

        // Search filter (name or position)
        if (search) {
            queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
            whereConditions.push(`(
                u.first_name ILIKE $${paramCounter} OR
                u.last_name ILIKE $${paramCounter + 1} OR
                md.current_position ILIKE $${paramCounter + 2}
            )`);
            paramCounter += 3;
        }

        // Occupation filter
        if (occupation) {
            queryParams.push(occupation);
            whereConditions.push(`md.occupation_area = $${paramCounter}`);
            paramCounter++;
        }

        // Company filter
        if (company) {
            queryParams.push(company);
            whereConditions.push(`md.company = $${paramCounter}`);
            paramCounter++;
        }

        // Years of experience filter
        if (yearsOfExperience) {
            queryParams.push(yearsOfExperience);
            whereConditions.push(`md.years_of_experience = $${paramCounter}`);
            paramCounter++;
        }

        // Position filter
        if (position) {
            queryParams.push(position);
            whereConditions.push(`md.current_position = $${paramCounter}`);
            paramCounter++;
        }

        // University filter
        if (university) {
            queryParams.push(university);
            whereConditions.push(`md.university = $${paramCounter}`);
            paramCounter++;
        }

        // Faculty filter
        if (faculty) {
            queryParams.push(faculty);
            whereConditions.push(`md.faculty = $${paramCounter}`);
            paramCounter++;
        }

        const whereClause = whereConditions.join(' AND ');

        // Get total count for pagination
        const countQuery = `
            SELECT COUNT(*)
            FROM users u
            INNER JOIN mentor_details md ON u.id = md.user_id
            WHERE ${whereClause}
        `;
        const countResult = await pool.query(countQuery, queryParams);
        const totalMentors = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalMentors / parseInt(limit));

        // Get mentors with details
        const mentorsQuery = `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                md.occupation_area,
                md.current_position,
                md.company,
                md.years_of_experience,
                md.university,
                md.faculty,
                md.bio,
                md.linkedin,
                md.photo_url,
                md.created_at
            FROM users u
            INNER JOIN mentor_details md ON u.id = md.user_id
            WHERE ${whereClause}
            ORDER BY md.created_at DESC
            LIMIT $${paramCounter} OFFSET $${paramCounter + 1}
        `;

        queryParams.push(parseInt(limit), offset);
        const mentorsResult = await pool.query(mentorsQuery, queryParams);

        // Format response
        const mentors = mentorsResult.rows.map(mentor => ({
            id: mentor.id,
            firstName: mentor.first_name,
            lastName: mentor.last_name,
            name: `${mentor.first_name} ${mentor.last_name}`,
            email: mentor.email,
            occupationArea: mentor.occupation_area,
            currentPosition: mentor.current_position,
            company: mentor.company,
            yearsOfExperience: mentor.years_of_experience,
            university: mentor.university,
            faculty: mentor.faculty,
            bio: mentor.bio,
            linkedin: mentor.linkedin,
            photoUrl: mentor.photo_url,
            createdAt: mentor.created_at
        }));

        res.json({
            success: true,
            mentors,
            totalMentors,
            totalPages,
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error('Error fetching mentors:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch mentors',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
