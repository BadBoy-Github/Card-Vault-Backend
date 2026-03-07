const nodemailer = require('nodemailer');

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

// Email handler for all email operations
module.exports = async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { type, data } = req.body;

    if (!type) {
        return res.status(400).json({ message: 'Email type is required' });
    }

    try {
        const transporter = createTransporter();
        const fromEmail = process.env.EMAIL_FROM || process.env.SMTP_USER;

        switch (type) {
            case 'contact': {
                // Send contact form email
                const { name, email, category, subject, message } = data;

                if (!name || !email || !category || !subject || !message) {
                    return res.status(400).json({ message: 'All fields are required' });
                }

                const mailOptions = {
                    from: fromEmail,
                    to: process.env.DEFAULT_ADMIN_EMAIL || 'elayabarathiedison@gmail.com',
                    subject: `[${category}] ${subject} - Contact Form`,
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                            <h2 style="color: #333;">New Contact Form Submission</h2>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Name:</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Email:</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${email}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Category:</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${category}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Subject:</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${subject}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd; font-weight: bold;">Message:</td>
                                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${message}</td>
                                </tr>
                            </table>
                        </div>
                    `,
                };

                await transporter.sendMail(mailOptions);
                return res.status(200).json({ message: 'Email sent successfully' });
            }

            case 'otp': {
                // Send OTP email for password reset
                const { toEmail, otp, expiryTime } = data;

                if (!toEmail || !otp) {
                    return res.status(400).json({ message: 'Email and OTP are required' });
                }

                const mailOptions = {
                    from: fromEmail,
                    to: toEmail,
                    subject: 'Password Reset OTP - Card Vault',
                    html: `
                        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2 style="color: #333;">Password Reset Request</h2>
                            <p>You requested to reset your password for your Card Vault account.</p>
                            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0;">
                                <p style="margin: 0; color: #666; font-size: 14px;">Your OTP is:</p>
                                <p style="margin: 10px 0 0 0; font-size: 32px; font-weight: bold; color: #333; letter-spacing: 5px;">${otp}</p>
                            </div>
                            <p style="color: #666; font-size: 14px;">This OTP will expire in 3 minutes.</p>
                            <p style="color: #999; font-size: 12px; margin-top: 30px;">If you didn't request this, please ignore this email.</p>
                        </div>
                    `,
                };

                await transporter.sendMail(mailOptions);
                return res.status(200).json({ message: 'OTP sent successfully' });
            }

            default:
                return res.status(400).json({ message: 'Invalid email type' });
        }
    } catch (error) {
        console.error('Email error:', error);
        return res.status(500).json({ message: 'Failed to send email', error: error.message });
    }
};
