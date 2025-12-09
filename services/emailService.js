import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const senderEmail = process.env.RESEND_FROM_EMAIL // <-- Define this
const fromEmail = `Z-Academy <${senderEmail}>`
const companyEmail = process.env.COMPANY_EMAIL;
console.log('fromEmail', fromEmail)
/**
 * Send welcome email to newly registered student
 * @param {Object} user - User object containing firstName, lastName, and email
 * @returns {Promise<Object>} - Resend API response
 */
export const sendStudentWelcomeEmail = async (user) => {
    try {
        // Build recipient list - always include user, optionally include company email
        const recipients = [user.email];
        if (companyEmail) {
            recipients.push(companyEmail);
        }

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: recipients,
            subject: 'Welcome to Z-Academy!',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Z-Academy!</h1>
                    </div>

                    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #667eea; margin-top: 0;">Hi ${user.firstName},</h2>

                        <p>Thank you for joining Z-Academy! We're excited to have you as part of our mentorship community.</p>

                        <p>As a student on our platform, you now have access to:</p>
                        <ul style="line-height: 2;">
                            <li>Connect with experienced mentors in your field</li>
                            <li>Schedule 1-on-1 mentorship sessions</li>
                            <li>Access to valuable learning resources</li>
                            <li>Personalized career guidance</li>
                        </ul>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/student-dashboard"
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                Go to Z-Academy
                            </a>
                        </div>

                        <p>If you have any questions, feel free to reach out to our support team.</p>

                        <p style="margin-top: 30px;">
                            Best regards,<br>
                            <strong>The Z-Academy Team</strong>
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>This email was sent to ${user.email}</p>
                        <p>&copy; ${new Date().getFullYear()} Z-Academy. All rights reserved.</p>
                    </div>
                </body>
                </html>
            `
        });

        if (error) {
            console.error('Error sending student welcome email:', error);
            throw error;
        }

        console.log('Student welcome email sent successfully:', data);
        return data;
    } catch (error) {
        console.error('Failed to send student welcome email:', error);
        throw error;
    }
};

/**
 * Send welcome email to newly registered mentor
 * @param {Object} user - User object containing firstName, lastName, and email
 * @returns {Promise<Object>} - Resend API response
 */
export const sendMentorWelcomeEmail = async (user) => {
    try {
        // Build recipient list - always include user, optionally include company email
        const recipients = [user.email];
        if (companyEmail) {
            recipients.push(companyEmail);
        }

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: recipients,
            subject: 'Welcome to Z-Academy - Mentor Application Received',
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Z-Academy!</h1>
                    </div>

                    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2 style="color: #667eea; margin-top: 0;">Hi ${user.firstName},</h2>

                        <p>Thank you for applying to become a mentor at Z-Academy! We're thrilled that you want to share your expertise and help guide the next generation of professionals.</p>

                        <div style="background-color: #e7f3ff; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0;">
                            <p style="margin: 0;"><strong>What's Next?</strong></p>
                            <p style="margin: 10px 0 0 0;">Our team will review your application and get back to you within 2-3 business days.</p>
                        </div>

                        <p>As a mentor on our platform, you'll be able to:</p>
                        <ul style="line-height: 2;">
                            <li>Share your knowledge and experience with eager students</li>
                            <li>Set your own availability and schedule</li>
                            <li>Build your professional brand</li>
                            <li>Make a meaningful impact on others' careers</li>
                        </ul>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}"
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                               Go to Z-Academy
                            </a>
                        </div>

                        <p>In the meantime, you can complete your profile and explore the platform.</p>

                        <p style="margin-top: 30px;">
                            Best regards,<br>
                            <strong>The Z-Academy Team</strong>
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>This email was sent to ${user.email}</p>
                        <p>&copy; ${new Date().getFullYear()} Z-Academy. All rights reserved.</p>
                    </div>
                </body>
                </html>
            `
        });

        if (error) {
            console.error('Error sending mentor welcome email:', error);
            throw error;
        }

        console.log('Mentor welcome email sent successfully:', data);
        return data;
    } catch (error) {
        console.error('Failed to send mentor welcome email:', error);
        throw error;
    }
};

/**
 * Send application submission notification to company email
 * @param {Object} mentorData - Mentor object containing mentor information
 * @returns {Promise<Object>} - Resend API response
 */
export const sendMentorApplicationNotification = async (mentorData) => {
    try {
        if (!companyEmail) {
            console.warn('COMPANY_EMAIL not set, skipping application notification');
            return;
        }

        const { data, error } = await resend.emails.send({
            from: fromEmail,
            to: companyEmail,
            subject: `New Mentor Application Submitted - ${mentorData.firstName} ${mentorData.lastName}`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                </head>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1 style="color: white; margin: 0; font-size: 28px;">New Mentor Application</h1>
                    </div>

                    <div style="background-color: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <div style="background-color: #e7f3ff; border-left: 4px solid #667eea; padding: 15px; margin-bottom: 20px;">
                            <p style="margin: 0;"><strong>A new mentor has submitted their application for review.</strong></p>
                        </div>

                        <h2 style="color: #667eea; margin-top: 0;">Mentor Information</h2>

                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold; width: 40%;">Name:</td>
                                <td style="padding: 10px;">${mentorData.firstName} ${mentorData.lastName}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Email:</td>
                                <td style="padding: 10px;">${mentorData.email}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Phone:</td>
                                <td style="padding: 10px;">${mentorData.countryCode || ''} ${mentorData.phone}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Position:</td>
                                <td style="padding: 10px;">${mentorData.currentPosition}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Company:</td>
                                <td style="padding: 10px;">${mentorData.company || 'N/A'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Occupation Area:</td>
                                <td style="padding: 10px;">${mentorData.occupationArea}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Experience:</td>
                                <td style="padding: 10px;">${mentorData.yearsOfExperience || 'N/A'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">University:</td>
                                <td style="padding: 10px;">${mentorData.university}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Faculty:</td>
                                <td style="padding: 10px;">${mentorData.faculty}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">Document Type:</td>
                                <td style="padding: 10px;">${mentorData.documentType === 'individual_entrepreneur' ? 'Individual Entrepreneur' : 'Private Individual'}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #ddd;">
                                <td style="padding: 10px; font-weight: bold;">LinkedIn:</td>
                                <td style="padding: 10px;">${mentorData.linkedin ? `<a href="${mentorData.linkedin}" style="color: #667eea;">${mentorData.linkedin}</a>` : 'N/A'}</td>
                            </tr>
                        </table>

                        <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">Bio:</h3>
                            <p style="margin: 0; white-space: pre-line;">${mentorData.bio}</p>
                        </div>

                        <div style="background-color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <h3 style="color: #333; margin-top: 0;">Availability:</h3>
                            <p style="margin: 0;"><strong>Timezone:</strong> ${mentorData.timezone}</p>
                            <p style="margin: 10px 0 0 0;"><strong>Time Slots:</strong> ${mentorData.totalTimeSlots} slots configured</p>
                        </div>

                        <div style="background-color: white; padding: 15px; border-radius: 8px;">
                            <h3 style="color: #333; margin-top: 0;">Service Pricing:</h3>
                            <p style="margin: 0;">
                                <strong>Mentor Session Price:</strong> ₾${mentorData.mentorSessionPrice}<br>
                                <strong>Platform Fee:</strong> ₾${mentorData.platformFee}<br>
                                <strong>Taxes:</strong> ₾${mentorData.taxesFee}<br>
                                <strong>Total (Student Pays):</strong> ₾${mentorData.totalPrice}
                            </p>
                        </div>

                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/admin"
                               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                                Review Application
                            </a>
                        </div>

                        <p style="margin-top: 30px; font-size: 12px; color: #666;">
                            This is an automated notification from Z-Academy.<br>
                            Submitted on: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Tbilisi' })} (Tbilisi Time)
                        </p>
                    </div>

                    <div style="text-align: center; margin-top: 20px; color: #666; font-size: 12px;">
                        <p>&copy; ${new Date().getFullYear()} Z-Academy. All rights reserved.</p>
                    </div>
                </body>
                </html>
            `
        });

        if (error) {
            console.error('Error sending application notification:', error);
            throw error;
        }

        console.log('Application notification email sent successfully:', data);
        return data;
    } catch (error) {
        console.error('Failed to send application notification:', error);
        throw error;
    }
};

