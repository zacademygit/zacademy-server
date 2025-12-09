import express from 'express';
import pool from '../db/config.js';
import { authenticateUser, requireMentor, requireStudent } from '../middleware/auth.js';
import { sendMentorApplicationNotification } from '../services/emailService.js';

const router = express.Router();

// Get mentor profile
router.get('/mentor/profile', authenticateUser, requireMentor, async (req, res) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.country_code,
                u.created_at,
                md.occupation_area,
                md.current_position,
                md.company,
                md.years_of_experience,
                md.university,
                md.faculty,
                md.bio,
                md.linkedin,
                md.photo_url,
                md.application_status,
                md.rejection_reason,
                md.notes
            FROM users u
            LEFT JOIN mentor_details md ON u.id = md.user_id
            WHERE u.id = $1 AND u.user_type = 'mentor'
        `;

        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor profile not found'
            });
        }

        const mentor = result.rows[0];

        const profileData = {
            id: mentor.id,
            firstName: mentor.first_name,
            lastName: mentor.last_name,
            email: mentor.email,
            phone: mentor.phone,
            countryCode: mentor.country_code,
            occupationArea: mentor.occupation_area,
            currentPosition: mentor.current_position,
            company: mentor.company,
            yearsOfExperience: mentor.years_of_experience,
            university: mentor.university,
            faculty: mentor.faculty,
            bio: mentor.bio,
            linkedin: mentor.linkedin,
            photoUrl: mentor.photo_url,
            memberSince: mentor.created_at,
            applicationStatus: mentor.application_status,
            rejectionReason: mentor.rejection_reason,
            notes: mentor.notes
        };

        res.json({
            success: true,
            data: profileData
        });

    } catch (error) {
        console.error('Error fetching mentor profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update mentor profile
router.put('/mentor/profile', authenticateUser, requireMentor, async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            firstName,
            lastName,
            email,
            phone,
            countryCode,
            occupationArea,
            currentPosition,
            company,
            yearsOfExperience,
            university,
            faculty,
            bio,
            linkedin
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required personal information'
            });
        }

        if (!occupationArea || !currentPosition || !university || !faculty || !bio) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required professional information'
            });
        }

        if (bio.length < 100) {
            return res.status(400).json({
                success: false,
                message: 'Bio must be at least 100 characters long'
            });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Update users table
            await client.query(
                `UPDATE users SET
                    first_name = $1,
                    last_name = $2,
                    email = $3,
                    phone = $4,
                    country_code = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $6`,
                [firstName, lastName, email.toLowerCase(), phone, countryCode, userId]
            );

            // Update mentor_details table
            await client.query(
                `UPDATE mentor_details SET
                    occupation_area = $1,
                    current_position = $2,
                    company = $3,
                    years_of_experience = $4,
                    university = $5,
                    faculty = $6,
                    bio = $7,
                    linkedin = $8,
                    updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $9`,
                [
                    occupationArea,
                    currentPosition,
                    company || null,
                    yearsOfExperience || null,
                    university,
                    faculty,
                    bio,
                    linkedin || null,
                    userId
                ]
            );

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Profile updated successfully'
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error updating mentor profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get student profile
router.get('/student/profile', authenticateUser, requireStudent, async (req, res) => {
    try {
        const userId = req.user.id;

        const query = `
            SELECT
                id,
                first_name,
                last_name,
                email,
                phone,
                country_code,
                date_of_birth,
                created_at
            FROM users
            WHERE id = $1 AND user_type = 'user'
        `;

        const result = await pool.query(query, [userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found'
            });
        }

        const student = result.rows[0];

        const profileData = {
            id: student.id,
            firstName: student.first_name,
            lastName: student.last_name,
            email: student.email,
            phone: student.phone,
            countryCode: student.country_code,
            dateOfBirth: student.date_of_birth,
            memberSince: student.created_at
        };

        res.json({
            success: true,
            data: profileData
        });

    } catch (error) {
        console.error('Error fetching student profile:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update student profile
router.put('/student/profile', authenticateUser, requireStudent, async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            firstName,
            lastName,
            email,
            phone,
            countryCode,
            dateOfBirth
        } = req.body;

        // Validate required fields
        if (!firstName || !lastName || !email || !phone) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required information'
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

        // Update users table
        await pool.query(
            `UPDATE users SET
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                country_code = $5,
                date_of_birth = $6,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $7`,
            [firstName, lastName, email.toLowerCase(), phone, countryCode, dateOfBirth || null, userId]
        );

        res.json({
            success: true,
            message: 'Profile updated successfully'
        });

    } catch (error) {
        console.error('Error updating student profile:', error);

        // Check for duplicate email error
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'This email is already in use'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get mentor availability (frontend expects /availability)
router.get('/mentor/availability', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;

        const query = `
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

        const result = await pool.query(query, [mentorId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                schedule: {
                    Monday: [],
                    Tuesday: [],
                    Wednesday: [],
                    Thursday: [],
                    Friday: [],
                    Saturday: [],
                    Sunday: []
                },
                timezone: null,
                requiresTimezone: true
            });
        }

        const availability = result.rows[0];
        const schedule = availability.schedule || {};

        // Convert schedule format: backend uses lowercase days with {start, end}
        // Frontend expects capitalized days with array of {id, startTime, endTime}
        const formattedSchedule = {};
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

        days.forEach(day => {
            const dayLower = day.toLowerCase();
            const slots = schedule[dayLower] || [];
            formattedSchedule[day] = slots.map((slot, index) => ({
                id: `${dayLower}-${index}`,
                startTime: slot.start,
                endTime: slot.end
            }));
        });

        res.json({
            success: true,
            schedule: formattedSchedule,
            timezone: availability.timezone,
            requiresTimezone: false
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

// Save/Update mentor availability (upsert)
router.put('/mentor/availability', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;
        const { timezone, schedule } = req.body;

        // Validate required fields
        if (!timezone || !schedule) {
            return res.status(400).json({
                success: false,
                message: 'Timezone and schedule are required'
            });
        }

        // Validate timezone format (basic check for IANA identifier)
        const timezoneRegex = /^[A-Za-z]+\/[A-Za-z_]+$/;
        if (!timezoneRegex.test(timezone)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid timezone format. Expected IANA identifier (e.g., America/New_York)'
            });
        }

        // Validate schedule structure
        const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

        for (const day of validDays) {
            if (!Array.isArray(schedule[day])) {
                return res.status(400).json({
                    success: false,
                    message: `Schedule must include ${day} as an array`
                });
            }

            // Validate each time slot
            for (const slot of schedule[day]) {
                if (!slot.start || !slot.end) {
                    return res.status(400).json({
                        success: false,
                        message: `Each time slot must have start and end times on ${day}`
                    });
                }

                if (!timeRegex.test(slot.start) || !timeRegex.test(slot.end)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid time format on ${day}. Expected HH:MM (24-hour format)`
                    });
                }

                if (slot.start >= slot.end) {
                    return res.status(400).json({
                        success: false,
                        message: `Start time must be before end time on ${day}`
                    });
                }
            }

            // Check for overlapping slots
            const sortedSlots = [...schedule[day]].sort((a, b) => a.start.localeCompare(b.start));
            for (let i = 0; i < sortedSlots.length - 1; i++) {
                if (sortedSlots[i].end > sortedSlots[i + 1].start) {
                    return res.status(400).json({
                        success: false,
                        message: `Overlapping time slots detected on ${day}`
                    });
                }
            }
        }

        // Upsert (insert or update) availability
        const upsertQuery = `
            INSERT INTO mentor_availability (mentor_id, timezone, schedule)
            VALUES ($1, $2, $3)
            ON CONFLICT (mentor_id)
            DO UPDATE SET
                timezone = EXCLUDED.timezone,
                schedule = EXCLUDED.schedule,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        const result = await pool.query(upsertQuery, [mentorId, timezone, JSON.stringify(schedule)]);
        const availability = result.rows[0];

        res.json({
            success: true,
            message: 'Availability saved successfully',
            data: {
                id: availability.id,
                mentorId: availability.mentor_id,
                timezone: availability.timezone,
                schedule: availability.schedule,
                updatedAt: availability.updated_at
            }
        });

    } catch (error) {
        console.error('Error saving mentor availability:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save availability',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get mentor services
router.get('/mentor/services', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;

        const query = `
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
        `;

        const result = await pool.query(query, [mentorId]);

        // Return services or empty array if none exist
        const services = result.rows.map(row => ({
            id: row.id,
            mentorId: row.mentor_id,
            mentorshipService: row.mentorship_service,
            mentorSessionPrice: row.mentor_session_price,
            platformFee: row.platform_fee,
            taxesFee: row.taxes_fee,
            totalPrice: row.total_price,
            createdAt: row.created_at,
            updatedAt: row.updated_at
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

// Save/Update mentor services
router.put('/mentor/services', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;
        const { services } = req.body;

        // Validate services array
        if (!services || !Array.isArray(services)) {
            return res.status(400).json({
                success: false,
                message: 'Services must be an array'
            });
        }

        // Validate each service
        for (const service of services) {
            if (!service.mentorshipService || typeof service.mentorshipService !== 'string') {
                return res.status(400).json({
                    success: false,
                    message: 'Each service must have a valid mentorship service name'
                });
            }

            if (!service.mentorSessionPrice || typeof service.mentorSessionPrice !== 'number' || service.mentorSessionPrice <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each service must have a valid mentor session price (positive integer)'
                });
            }

            if (typeof service.platformFee !== 'number' || service.platformFee < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each service must have a valid platform fee (non-negative integer)'
                });
            }

            if (typeof service.taxesFee !== 'number' || service.taxesFee < 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each service must have a valid taxes fee (non-negative integer)'
                });
            }

            if (!service.totalPrice || typeof service.totalPrice !== 'number' || service.totalPrice <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each service must have a valid total price (positive integer)'
                });
            }

            // Ensure all prices are integers
            if (!Number.isInteger(service.mentorSessionPrice) || !Number.isInteger(service.platformFee) ||
                !Number.isInteger(service.taxesFee) || !Number.isInteger(service.totalPrice)) {
                return res.status(400).json({
                    success: false,
                    message: 'All prices must be whole numbers (no decimals)'
                });
            }

            // Verify total price calculation
            const calculatedTotal = service.mentorSessionPrice + service.platformFee + service.taxesFee;
            if (service.totalPrice !== calculatedTotal) {
                return res.status(400).json({
                    success: false,
                    message: `Total price mismatch. Expected ${calculatedTotal}, got ${service.totalPrice}`
                });
            }
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Delete existing services for this mentor
            await client.query('DELETE FROM mentor_services WHERE mentor_id = $1', [mentorId]);

            // Insert new services
            const insertedServices = [];
            for (const service of services) {
                const insertQuery = `
                    INSERT INTO mentor_services (
                        mentor_id,
                        mentorship_service,
                        mentor_session_price,
                        platform_fee,
                        taxes_fee,
                        total_price
                    )
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING id, mentor_id, mentorship_service, mentor_session_price,
                              platform_fee, taxes_fee, total_price, created_at, updated_at
                `;

                const result = await client.query(insertQuery, [
                    mentorId,
                    service.mentorshipService,
                    service.mentorSessionPrice,
                    service.platformFee,
                    service.taxesFee,
                    service.totalPrice
                ]);

                insertedServices.push({
                    id: result.rows[0].id,
                    mentorId: result.rows[0].mentor_id,
                    mentorshipService: result.rows[0].mentorship_service,
                    mentorSessionPrice: result.rows[0].mentor_session_price,
                    platformFee: result.rows[0].platform_fee,
                    taxesFee: result.rows[0].taxes_fee,
                    totalPrice: result.rows[0].total_price,
                    createdAt: result.rows[0].created_at,
                    updatedAt: result.rows[0].updated_at
                });
            }

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Services saved successfully',
                data: insertedServices
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error saving mentor services:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save services',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get mentor document confirmation status
router.get('/mentor/document-status', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;

        // Get mentor's application status
        const mentorResult = await pool.query(
            'SELECT application_status FROM mentor_details WHERE user_id = $1',
            [mentorId]
        );

        if (mentorResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor details not found'
            });
        }

        const applicationStatus = mentorResult.rows[0].application_status;

        // Get document confirmation status
        const docResult = await pool.query(
            'SELECT document_type, confirmed, confirmed_at FROM mentor_document_confirmations WHERE mentor_id = $1',
            [mentorId]
        );

        const hasConfirmed = docResult.rows.length > 0;
        const documentData = hasConfirmed ? {
            documentType: docResult.rows[0].document_type,
            confirmed: docResult.rows[0].confirmed,
            confirmedAt: docResult.rows[0].confirmed_at
        } : null;

        res.json({
            success: true,
            applicationStatus,
            hasConfirmed,
            documentConfirmation: documentData
        });

    } catch (error) {
        console.error('Error fetching document status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch document status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Confirm mentor document type
router.post('/mentor/confirm-document', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;
        const { documentType } = req.body;

        // Validate document type
        if (!documentType || !['individual_entrepreneur', 'private_individual'].includes(documentType)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid document type. Must be "individual_entrepreneur" or "private_individual"'
            });
        }

        // Check if mentor is in pending status
        const mentorResult = await pool.query(
            'SELECT application_status FROM mentor_details WHERE user_id = $1',
            [mentorId]
        );

        if (mentorResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor details not found'
            });
        }

        const applicationStatus = mentorResult.rows[0].application_status;

        // Only pending mentors can/need to confirm documents
        if (applicationStatus !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Document confirmation is only available for pending applications'
            });
        }

        // Check if already confirmed (UNIQUE constraint will prevent this, but check anyway)
        const existingDoc = await pool.query(
            'SELECT id FROM mentor_document_confirmations WHERE mentor_id = $1',
            [mentorId]
        );

        if (existingDoc.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Document type has already been confirmed. Please contact support to make changes.',
                alreadyConfirmed: true
            });
        }

        // Get IP address and user agent for audit trail
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        // Insert document confirmation
        const result = await pool.query(
            `INSERT INTO mentor_document_confirmations (
                mentor_id,
                document_type,
                confirmed,
                ip_address,
                user_agent
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING id, document_type, confirmed, confirmed_at`,
            [mentorId, documentType, true, ipAddress, userAgent]
        );

        const confirmation = result.rows[0];

        res.json({
            success: true,
            message: 'Document type confirmed successfully',
            documentConfirmation: {
                documentType: confirmation.document_type,
                confirmed: confirmation.confirmed,
                confirmedAt: confirmation.confirmed_at
            }
        });

    } catch (error) {
        // Handle unique constraint violation
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                message: 'Document type has already been confirmed. Please contact support to make changes.',
                alreadyConfirmed: true
            });
        }

        console.error('Error confirming document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to confirm document type',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Get mentor payment information
router.get('/mentor/payment-info', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;

        const query = `
            SELECT
                identification_number,
                address,
                bank,
                bank_rtgs_code,
                bank_account_number
            FROM mentor_payment_info
            WHERE mentor_id = $1
        `;

        const result = await pool.query(query, [mentorId]);

        if (result.rows.length === 0) {
            return res.json({
                success: true,
                identificationNumber: '',
                address: '',
                bank: '',
                bankRtgsCode: '',
                bankAccountNumber: ''
            });
        }

        res.json({
            success: true,
            identificationNumber: result.rows[0].identification_number || '',
            address: result.rows[0].address || '',
            bank: result.rows[0].bank || '',
            bankRtgsCode: result.rows[0].bank_rtgs_code || '',
            bankAccountNumber: result.rows[0].bank_account_number || ''
        });

    } catch (error) {
        console.error('Error fetching payment info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch payment information',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Update mentor payment information
router.put('/mentor/payment-info', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;
        const { identificationNumber, address, bank, bankRtgsCode, bankAccountNumber } = req.body;

        // Validate required fields
        if (!identificationNumber || typeof identificationNumber !== 'string' || identificationNumber.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide your identification number'
            });
        }

        if (!address || typeof address !== 'string' || address.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide your address'
            });
        }

        if (!bank || typeof bank !== 'string' || bank.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please select a bank'
            });
        }

        if (!bankRtgsCode || typeof bankRtgsCode !== 'string' || bankRtgsCode.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide the bank RTGS code'
            });
        }

        if (!bankAccountNumber || typeof bankAccountNumber !== 'string' || bankAccountNumber.trim() === '') {
            return res.status(400).json({
                success: false,
                message: 'Please provide your bank account number'
            });
        }

        // Upsert payment info (insert or update)
        const upsertQuery = `
            INSERT INTO mentor_payment_info (
                mentor_id,
                identification_number,
                address,
                bank,
                bank_rtgs_code,
                bank_account_number
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (mentor_id)
            DO UPDATE SET
                identification_number = EXCLUDED.identification_number,
                address = EXCLUDED.address,
                bank = EXCLUDED.bank,
                bank_rtgs_code = EXCLUDED.bank_rtgs_code,
                bank_account_number = EXCLUDED.bank_account_number,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        `;

        await pool.query(upsertQuery, [
            mentorId,
            identificationNumber.trim(),
            address.trim(),
            bank.trim(),
            bankRtgsCode.trim(),
            bankAccountNumber.trim()
        ]);

        res.json({
            success: true,
            message: 'Payment information updated successfully'
        });

    } catch (error) {
        console.error('Error updating payment info:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update payment information',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Submit mentor application
router.post('/mentor/send-application', authenticateUser, requireMentor, async (req, res) => {
    try {
        const mentorId = req.user.id;

        // Get mentor profile data
        const profileQuery = `
            SELECT
                u.id,
                u.first_name,
                u.last_name,
                u.email,
                u.phone,
                u.country_code,
                md.occupation_area,
                md.current_position,
                md.company,
                md.years_of_experience,
                md.university,
                md.faculty,
                md.bio,
                md.linkedin,
                md.application_status
            FROM users u
            LEFT JOIN mentor_details md ON u.id = md.user_id
            WHERE u.id = $1 AND u.user_type = 'mentor'
        `;

        const profileResult = await pool.query(profileQuery, [mentorId]);

        if (profileResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor profile not found'
            });
        }

        const mentor = profileResult.rows[0];

        // Only pending mentors can submit application (not approved/rejected)
        if (mentor.application_status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'Application submission is only available for pending applications'
            });
        }

        // Get document confirmation
        const docResult = await pool.query(
            'SELECT document_type FROM mentor_document_confirmations WHERE mentor_id = $1',
            [mentorId]
        );

        if (docResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please confirm your document type before submitting your application'
            });
        }

        // Get availability
        const availabilityResult = await pool.query(
            'SELECT timezone, schedule FROM mentor_availability WHERE mentor_id = $1',
            [mentorId]
        );

        if (availabilityResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please set your availability before submitting your application'
            });
        }

        const availability = availabilityResult.rows[0];

        // Count total time slots
        const schedule = availability.schedule || {};
        let totalTimeSlots = 0;
        Object.values(schedule).forEach(slots => {
            totalTimeSlots += slots.length;
        });

        if (totalTimeSlots === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please add at least one time slot before submitting your application'
            });
        }

        // Get services
        const servicesResult = await pool.query(
            'SELECT mentorship_service, mentor_session_price, platform_fee, taxes_fee, total_price FROM mentor_services WHERE mentor_id = $1',
            [mentorId]
        );

        if (servicesResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please set your service pricing before submitting your application'
            });
        }

        const service = servicesResult.rows[0];

        // Get payment info
        const paymentResult = await pool.query(
            'SELECT identification_number, address, bank, bank_rtgs_code, bank_account_number FROM mentor_payment_info WHERE mentor_id = $1',
            [mentorId]
        );

        if (paymentResult.rows.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please complete your payment information before submitting your application'
            });
        }

        const payment = paymentResult.rows[0];
        if (!payment.identification_number || !payment.address || !payment.bank ||
            !payment.bank_rtgs_code || !payment.bank_account_number) {
            return res.status(400).json({
                success: false,
                message: 'Please complete all payment information fields before submitting your application'
            });
        }

        // Prepare data for email notification
        const mentorData = {
            firstName: mentor.first_name,
            lastName: mentor.last_name,
            email: mentor.email,
            phone: mentor.phone,
            countryCode: mentor.country_code,
            currentPosition: mentor.current_position,
            company: mentor.company,
            occupationArea: mentor.occupation_area,
            yearsOfExperience: mentor.years_of_experience,
            university: mentor.university,
            faculty: mentor.faculty,
            bio: mentor.bio,
            linkedin: mentor.linkedin,
            documentType: docResult.rows[0].document_type,
            timezone: availability.timezone,
            totalTimeSlots,
            mentorSessionPrice: service.mentor_session_price,
            platformFee: service.platform_fee,
            taxesFee: service.taxes_fee,
            totalPrice: service.total_price
        };

        // Send email notification (non-blocking)
        sendMentorApplicationNotification(mentorData).catch(err => {
            console.error('Failed to send application notification email:', err);
            // Don't fail the request if email fails
        });

        res.json({
            success: true,
            message: 'Application submitted successfully! We will review it within 24 hours.'
        });

    } catch (error) {
        console.error('Error submitting application:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit application',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
