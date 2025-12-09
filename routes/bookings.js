import express from 'express';
import pool from '../db/config.js';
import { authenticateUser, requireStudent } from '../middleware/auth.js';

const router = express.Router();

// Get booked time slots for a mentor on a specific date - Public endpoint
router.get('/booked-times/:mentorId', async (req, res) => {
    try {
        const { mentorId } = req.params;
        const { date } = req.query; // Expected format: YYYY-MM-DD

        if (!date) {
            return res.status(400).json({
                success: false,
                message: 'Date parameter is required'
            });
        }

        // Get start and end of the day in UTC
        const startOfDay = new Date(date + 'T00:00:00.000Z');
        const endOfDay = new Date(date + 'T23:59:59.999Z');

        // Fetch all non-cancelled bookings for this mentor on this date
        const query = `
            SELECT session_date, duration_minutes
            FROM bookings
            WHERE mentor_id = $1
            AND status != 'cancelled'
            AND session_date >= $2
            AND session_date <= $3
            ORDER BY session_date
        `;

        const result = await pool.query(query, [mentorId, startOfDay.toISOString(), endOfDay.toISOString()]);

        // Return array of booked time slots with their durations
        const bookedSlots = result.rows.map(row => ({
            sessionDate: row.session_date,
            durationMinutes: row.duration_minutes
        }));

        res.json({
            success: true,
            bookedSlots
        });

    } catch (error) {
        console.error('Error fetching booked times:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booked times',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Check if user has existing booking with a mentor
router.get('/check/:mentorId', authenticateUser, async (req, res) => {
    try {
        const userId = req.user.id;
        const { mentorId } = req.params;

        // Check for any non-cancelled bookings with this mentor
        const query = `
            SELECT COUNT(*) as booking_count
            FROM bookings
            WHERE user_id = $1
            AND mentor_id = $2
            AND status != 'cancelled'
        `;

        const result = await pool.query(query, [userId, mentorId]);
        const hasBooking = parseInt(result.rows[0].booking_count) > 0;

        res.json({
            success: true,
            hasBooking
        });

    } catch (error) {
        console.error('Error checking existing bookings:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Create a new booking
router.post('/', authenticateUser, requireStudent, async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            mentorId,
            serviceId,
            sessionDate, // ISO string in UTC
            sessionTopic,
            notes
        } = req.body;

        // Validate required fields
        if (!mentorId || !serviceId || !sessionDate) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields: mentorId, serviceId, sessionDate'
            });
        }

        // Verify mentor exists
        const mentorCheck = await pool.query(
            'SELECT id FROM users WHERE id = $1 AND user_type = $2',
            [mentorId, 'mentor']
        );

        if (mentorCheck.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Mentor not found'
            });
        }

        // Verify service exists and get pricing
        const serviceQuery = await pool.query(
            'SELECT * FROM mentor_services WHERE id = $1 AND mentor_id = $2',
            [serviceId, mentorId]
        );

        if (serviceQuery.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Service not found'
            });
        }

        const service = serviceQuery.rows[0];

        // Parse and validate session date
        const sessionDateObj = new Date(sessionDate);
        if (isNaN(sessionDateObj.getTime())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid session date format'
            });
        }

        // Check if session date is in the future
        if (sessionDateObj <= new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Session date must be in the future'
            });
        }

        // Check for double booking - prevent overlapping bookings for the same mentor
        const durationMinutes = 60; // Default duration
        const sessionEndDate = new Date(sessionDateObj.getTime() + durationMinutes * 60 * 1000);

        const overlapCheck = await pool.query(`
            SELECT id FROM bookings
            WHERE mentor_id = $1
            AND status != 'cancelled'
            AND (
                -- New booking starts during existing booking
                (session_date <= $2 AND (session_date + (duration_minutes * INTERVAL '1 minute')) > $2)
                OR
                -- New booking ends during existing booking
                (session_date < $3 AND (session_date + (duration_minutes * INTERVAL '1 minute')) >= $3)
                OR
                -- New booking encompasses existing booking
                (session_date >= $2 AND (session_date + (duration_minutes * INTERVAL '1 minute')) <= $3)
            )
        `, [mentorId, sessionDateObj.toISOString(), sessionEndDate.toISOString()]);

        if (overlapCheck.rows.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'This time slot is already booked. Please select a different time.'
            });
        }

        // Create booking
        const insertQuery = `
            INSERT INTO bookings (
                mentor_id,
                user_id,
                service_id,
                session_date,
                duration_minutes,
                session_topic,
                notes,
                mentor_price,
                platform_fee,
                taxes_fee,
                total_price,
                status,
                payment_status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING id, mentor_id, user_id, service_id, session_date, duration_minutes,
                      session_topic, notes, mentor_price, platform_fee, taxes_fee, total_price,
                      status, payment_status, created_at, updated_at
        `;

        const result = await pool.query(insertQuery, [
            mentorId,
            userId,
            serviceId,
            sessionDateObj.toISOString(), // Store in UTC
            60, // Default 60 minutes
            sessionTopic || null,
            notes || null,
            service.mentor_session_price,
            service.platform_fee,
            service.taxes_fee,
            service.total_price,
            'pending',
            'pending'
        ]);

        const booking = result.rows[0];

        // Format response
        const bookingData = {
            id: booking.id,
            mentorId: booking.mentor_id,
            userId: booking.user_id,
            serviceId: booking.service_id,
            sessionDate: booking.session_date,
            durationMinutes: booking.duration_minutes,
            sessionTopic: booking.session_topic,
            notes: booking.notes,
            mentorPrice: booking.mentor_price,
            platformFee: booking.platform_fee,
            taxesFee: booking.taxes_fee,
            totalPrice: booking.total_price,
            status: booking.status,
            paymentStatus: booking.payment_status,
            createdAt: booking.created_at,
            updatedAt: booking.updated_at
        };

        res.status(201).json({
            success: true,
            message: 'Booking created successfully',
            data: bookingData
        });

    } catch (error) {
        console.error('Error creating booking:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

export default router;
