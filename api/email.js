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
                        <div style="font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5; padding:30px 10px;">

  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e5e5e5;">

    <!-- Header -->
    <div style="padding:26px 28px; border-bottom:1px solid #e5e5e5; text-align:center;">
      <div style="font-size:12px; letter-spacing:2px; color:#777;">CARD VAULT</div>
      <h2 style="margin:8px 0 4px 0; font-weight:600; color:#222;">New Contact Message</h2>
      <div style="font-size:13px; color:#777;">Someone contacted you from your website</div>
    </div>

    <!-- Content -->
    <div style="padding:28px;">

      <table style="width:100%; border-collapse:collapse;">

        <tr>
          <td style="padding:12px 0; font-weight:600; color:#555; width:35%; border-bottom:1px solid #eee;">
            Name
          </td>
          <td style="padding:12px 0; color:#333; border-bottom:1px solid #eee;">
            ${name}
          </td>
        </tr>

        <tr>
          <td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
            Email
          </td>
          <td style="padding:12px 0; color:#333; border-bottom:1px solid #eee;">
            ${email}
          </td>
        </tr>

        <tr>
          <td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
            Category
          </td>
          <td style="padding:12px 0; color:#333; border-bottom:1px solid #eee;">
            ${category}
          </td>
        </tr>

        <tr>
          <td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
            Subject
          </td>
          <td style="padding:12px 0; color:#333; border-bottom:1px solid #eee;">
            ${subject}
          </td>
        </tr>

      </table>

      <!-- Message -->
      <div style="margin-top:24px;">
        <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px; color:#777; margin-bottom:10px;">
          Message
        </div>

        <div style="background:#fafafa; border:1px solid #e5e5e5; padding:18px; border-radius:6px; line-height:1.6; color:#333;">
          ${message}
        </div>
      </div>

    </div>

    <!-- Footer -->
    <div style="padding:18px; border-top:1px solid #e5e5e5; text-align:center; font-size:12px; color:#777;">
      <div style="font-weight:600; color:#333;">Card Vault</div>
      Contact Form Notification<br>
      This email was automatically generated.
    </div>

  </div>

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
