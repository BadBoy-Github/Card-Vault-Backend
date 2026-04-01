const nodemailer = require('nodemailer');
const connectDB = require('./_lib/db');
const Newsletter = require('./_models/Newsletter');
const User = require('./_models/User');
const jwt = require('jsonwebtoken');

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

// Helper to get user from token
const getUserFromToken = async (req) => {
  let user = null;
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = await User.findById(decoded.id).select('-password');
    } catch (e) {
      // Invalid token
    }
  }
  return user;
};

// Email handler for all email and newsletter operations
module.exports = async function handler(req, res) {
  // CORS headers
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Handle newsletter routes
  const urlPath = req.url.split('?')[0];
  const isNewsletterRoute = urlPath.includes('/newsletter');

  if (isNewsletterRoute) {
    await connectDB();
    const { method, body } = req;
    const user = await getUserFromToken(req);
    const isAdmin = user && user.role === 'admin';

    // GET /api/newsletter - Get all newsletter subscribers (admin only)
    // GET /api/newsletter?email=xxx - Check subscription status for an email
    if (method === 'GET') {
      try {
        // Check if email query parameter is provided (for checking subscription status)
        const email = req.query.email;
        if (email) {
          const subscriber = await Newsletter.findOne({ email: email.toLowerCase().trim() });
          if (subscriber && subscriber.isActive) {
            return res.status(200).json({ subscribed: true, subscriber });
          }
          return res.status(200).json({ subscribed: false });
        }

        // Admin only for getting all subscribers
        if (!isAdmin) {
          return res.status(403).json({ message: 'Not authorized as admin' });
        }
        const subscribers = await Newsletter.find({ isActive: true }).sort({ subscribedAt: -1 });
        return res.status(200).json(subscribers);
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    // POST /api/newsletter - Subscribe to newsletter
    if (method === 'POST') {
      try {
        const { name, email, age, phone, likedCategories } = body;

        if (!name || !email) {
          return res.status(400).json({ message: 'Name and email are required' });
        }

        // Check if already subscribed
        const existing = await Newsletter.findOne({ email: email.toLowerCase().trim() });
        if (existing) {
          if (!existing.isActive) {
            // Reactivate the subscription
            existing.isActive = true;
            existing.name = name;
            existing.age = age;
            existing.phone = phone;
            existing.likedCategories = likedCategories || [];
            if (user) {
              existing.user = user._id;
            }
            await existing.save();
            return res.status(200).json({ message: 'Newsletter subscription reactivated', subscriber: existing });
          }
          return res.status(400).json({ message: 'Email already subscribed to newsletter' });
        }

        // Create new subscription
        const subscriber = new Newsletter({
          user: user ? user._id : null,
          name,
          email: email.toLowerCase().trim(),
          age,
          phone,
          likedCategories: likedCategories || [],
        });

        await subscriber.save();
        return res.status(201).json({ message: 'Successfully subscribed to newsletter', subscriber });
      } catch (error) {
        if (error.code === 11000) {
          return res.status(400).json({ message: 'Email already subscribed to newsletter' });
        }
        return res.status(500).json({ message: error.message });
      }
    }

    // PUT /api/newsletter - Unsubscribe from newsletter
    if (method === 'PUT') {
      try {
        const { email, action } = body;

        if (action === 'unsubscribe' && email) {
          const subscriber = await Newsletter.findOne({ email: email.toLowerCase().trim() });
          if (subscriber) {
            subscriber.isActive = false;
            await subscriber.save();
            return res.status(200).json({ message: 'Unsubscribed from newsletter' });
          }
          return res.status(404).json({ message: 'Subscriber not found' });
        }

        return res.status(400).json({ message: 'Invalid action' });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    // DELETE /api/newsletter/:id - Delete subscriber (admin only)
    if (method === 'DELETE') {
      try {
        if (!isAdmin) {
          return res.status(403).json({ message: 'Not authorized as admin' });
        }

        const id = req.url.split('/').pop();
        const subscriber = await Newsletter.findByIdAndDelete(id);

        if (!subscriber) {
          return res.status(404).json({ message: 'Subscriber not found' });
        }

        return res.status(200).json({ message: 'Subscriber deleted' });
      } catch (error) {
        return res.status(500).json({ message: error.message });
      }
    }

    return res.status(405).json({ message: 'Method not allowed' });
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
          from: "Card Vault",
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
      <div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">card-vaults.vercel.app</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>
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
                        <div style="font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5; padding:30px 10px;">

  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e5e5e5;">

    <!-- Header -->
    <div style="padding:26px 28px; border-bottom:1px solid #e5e5e5; text-align:center;">
      <div style="font-size:12px; letter-spacing:2px; color:#777;">CARD VAULT</div>
      <h2 style="margin:8px 0 4px 0; font-weight:600; color:#222;">Password Reset Request</h2>
      <div style="font-size:13px; color:#777;">Secure verification required</div>
    </div>

    <!-- Content -->
    <div style="padding:28px; color:#333; font-size:14px; line-height:1.6;">

      <p style="margin-top:0;">
        You requested to reset your password for your <strong>Card Vault</strong> account.
        Please use the One-Time Password (OTP) below to proceed.
      </p>

      <!-- OTP Box -->
      <div style="background:#fafafa; border:1px solid #e5e5e5; border-radius:8px; padding:24px; text-align:center; margin:25px 0;">

        <div style="font-size:12px; letter-spacing:1px; color:#777; margin-bottom:6px;">
          ONE-TIME PASSWORD
        </div>

        <div style="font-size:34px; font-weight:600; letter-spacing:6px; color:#222;">
          ${otp}
        </div>

      </div>

      <p style="color:#555; font-size:13px;">
        This OTP will expire in <strong>3 minutes</strong>.
      </p>

      <p style="color:#777; font-size:13px;">
        If you did not request this password reset, you can safely ignore this email.
        Your account will remain secure.
      </p>

    </div>

    <!-- Footer -->
    <div style="padding:18px; border-top:1px solid #e5e5e5; text-align:center; font-size:12px; color:#777;">
      <div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">card-vaults.vercel.app</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>
    </div>

  </div>

</div>
                    `,
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'OTP sent successfully' });
      }

      case 'giftcard': {
        // Send gift card email to user
        const { toEmail, customerName, productName, cardNumber, pin, expiryDate, orderId } = data;

        if (!toEmail || !cardNumber || !pin || !expiryDate) {
          return res.status(400).json({ message: 'Email, card number, PIN, and expiry date are required' });
        }

        const maskedCard = cardNumber.substring(0, 4) + ' ' + cardNumber.substring(4, 8) + ' ' + cardNumber.substring(8, 12) + ' ' + cardNumber.substring(12, 16);

        const mailOptions = {
          from: "Card Vault",
          to: toEmail,
          subject: `🎁 Your Gift Card is Here! - ${productName}`,
          html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5;">

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5; padding:40px 10px;">
<tr>
<td align="center">

<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e6e6e6;">

<!-- Header -->

<tr>
<td style="padding:30px 30px 24px 30px; text-align:center; border-bottom:1px solid #eeeeee;">
<div style="font-size:12px; letter-spacing:3px; color:#888;">CARD VAULT</div>
<h1 style="margin:10px 0 5px 0; font-size:26px; font-weight:600; color:#222;">
Your Gift Card
</h1>
<p style="margin:0; font-size:14px; color:#777;">
Premium Digital Gift Card
</p>
</td>
</tr>


<!-- Main Content -->

<tr>
<td style="padding:30px;">

<p style="margin:0 0 20px 0; font-size:15px; color:#333; line-height:1.6;">
Dear <strong>${customerName}</strong>,
</p>

<p style="margin:0 0 25px 0; font-size:15px; color:#555; line-height:1.6;">
Thank you for your purchase. Your digital gift card is ready. 
Please find the card details below.
</p>


<!-- Product Box -->

<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; border:1px solid #eeeeee; border-radius:8px; margin-bottom:24px;">
<tr>
<td style="padding:18px; text-align:center;">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:5px;">
PRODUCT
</div>
<div style="font-size:20px; font-weight:600; color:#222;">
${productName}
</div>
</td>
</tr>
</table>


<!-- Card Details -->

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee; border-radius:8px; background:#fafafa;">
<tr>
<td style="padding:20px;">

<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:6px;">
CARD NUMBER
</div>

<div style="font-size:22px; font-weight:600; color:#222; letter-spacing:3px; font-family:'Courier New', monospace;">
${maskedCard}
</div>


<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
<tr>

<td width="50%">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:4px;">
PIN
</div>

<div style="font-size:18px; font-weight:600; color:#222; letter-spacing:2px;">
${pin}
</div>
</td>


<td width="50%" style="text-align:right;">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:4px;">
EXPIRY DATE
</div>

<div style="font-size:18px; font-weight:600; color:#666;">
${expiryDate}
</div>
</td>

</tr>
</table>

</td>
</tr>
</table>


<!-- Important Notice -->

<div style="margin-top:24px; padding:16px; background:#fafafa; border:1px solid #eeeeee; border-left:3px solid #cccccc; border-radius:6px;">
<div style="font-size:12px; font-weight:600; color:#444; margin-bottom:4px;">
Important
</div>

<div style="font-size:12px; color:#666; line-height:1.5;">
Please keep your card details secure. Do not share your PIN with anyone.
This card is non-refundable and non-transferable.
</div>
</div>


<!-- Order ID -->

<div style="margin-top:25px; text-align:center;">
<span style="font-size:11px; color:#888;">
Order ID: ${orderId}
</span>
</div>

</td>
</tr>


<!-- Footer -->

<tr>
<td style="padding:22px 30px; border-top:1px solid #eeeeee; text-align:center; background:#fafafa;">

<div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">card-vaults.vercel.app</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>

</td>
</tr>


</table>

<div style="height:40px;"></div>

</td>
</tr>
</table>

</body>
</html>
                    `,
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'Gift card email sent successfully' });
      }

      case 'neworder': {
        // Send new order notification to admin
        const { orderId, customerName, customerEmail, productName, totalPrice, orderItems, paymentStatus, orderDate } = data;

        if (!orderId || !customerName || !totalPrice) {
          return res.status(400).json({ message: 'Order ID, customer name, and total price are required' });
        }

        const itemsList = orderItems ? orderItems.map(item => `<li>${item.name || item.product || 'Product'} - Qty: ${item.qty || 1}</li>`).join('') : '<li>No items details available</li>';

        const mailOptions = {
          from: "Card Vault",
          to: process.env.DEFAULT_ADMIN_EMAIL || 'elayabarathiedison@gmail.com',
          subject: `🛒 New Order Placed - ${orderId}`,
          html: `

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5; padding:40px 10px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e6e6e6;">

<!-- HEADER -->

<tr>
<td style="padding:30px; text-align:center; border-bottom:1px solid #eeeeee;">

<div style="font-size:12px; letter-spacing:3px; color:#888;">
CARD VAULT
</div>

<h1 style="margin:10px 0 5px 0; font-size:24px; font-weight:600; color:#222;">
New Order Received
</h1>

<p style="margin:0; font-size:14px; color:#777;">
A customer has placed an order
</p>

</td>
</tr>


<!-- ORDER DETAILS -->

<tr>
<td style="padding:30px;">

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:14px;">

<tr>
<td style="padding:12px 0; font-weight:600; color:#555; width:40%; border-bottom:1px solid #eee;">
Order ID
</td>

<td style="padding:12px 0; color:#222; border-bottom:1px solid #eee;">
${orderId}
</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Customer Name
</td>

<td style="padding:12px 0; color:#222; border-bottom:1px solid #eee;">
${customerName}
</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Customer Email
</td>

<td style="padding:12px 0; color:#222; border-bottom:1px solid #eee;">
${customerEmail || 'Not provided'}
</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Total Amount
</td>

<td style="padding:12px 0; font-weight:600; color:#000; border-bottom:1px solid #eee;">
₹${totalPrice}
</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Payment Status
</td>

<td style="padding:12px 0; border-bottom:1px solid #eee;">

<span style="
padding:5px 10px;
border:1px solid #ccc;
border-radius:4px;
font-size:12px;
font-weight:600;
color:#333;
background:#f7f7f7;
">

${paymentStatus === 'pending'
              ? 'Pending'
              : paymentStatus === 'awaiting_verification'
                ? 'Awaiting Verification'
                : paymentStatus === 'verified'
                  ? 'Verified'
                  : paymentStatus}

</span>

</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Order Date
</td>

<td style="padding:12px 0; color:#222; border-bottom:1px solid #eee;">
${orderDate || new Date().toLocaleString()}
</td>
</tr>

</table>


<!-- ITEMS -->

<div style="margin-top:25px;">

<div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#777; margin-bottom:10px;">
Order Items
</div>

<div style="background:#fafafa; border:1px solid #eeeeee; border-radius:8px; padding:18px;">

<ul style="margin:0; padding-left:20px; color:#333; line-height:1.6;">
${itemsList}
</ul>

</div>

</div>

</td>
</tr>


<!-- BUTTON -->

<tr>
<td align="center" style="padding:0 30px 30px 30px;">

<a href="https://card-vaults.vercel.app/admin/dashboard"

style="
display:inline-block;
padding:14px 30px;
background:#111;
color:#ffffff;
text-decoration:none;
border-radius:6px;
font-weight:600;
font-size:14px;
">

View Order Details

</a>

</td>
</tr>


<!-- FOOTER -->

<tr>
<td style="padding:22px 30px; border-top:1px solid #eeeeee; text-align:center; background:#fafafa;">

<div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Admin Order Notification<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">
card-vaults.vercel.app
</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>

</td>
</tr>

</table>

<div style="height:40px;"></div>

</td>
</tr>
</table>

</body>
</html>

                    `,
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ message: 'Order notification sent successfully' });
      }

      default:
        return res.status(400).json({ message: 'Invalid email type' });
    }
  } catch (error) {
    console.error('Email error:', error);
    return res.status(500).json({ message: 'Failed to send email', error: error.message });
  }
};

// Order Confirmation Email - Sends to customer when they place an order
module.exports.sendOrderConfirmation = async function (toEmail, orderData) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const { orderId, customerName, productName, totalPrice, orderItems, orderDate } = orderData;
  const itemsList = orderItems ? orderItems.map(item => `<li>${item.name || item.product || 'Product'} - Qty: ${item.qty || 1}</li>`).join('') : '<li>No items details available</li>';

  const mailOptions = {
    from: "Card Vault",
    to: toEmail,
    subject: `✅ Order Confirmed - ${orderId}`,
    html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5; padding:40px 10px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e6e6e6;">

<!-- HEADER -->

<tr>
<td style="padding:30px; text-align:center; border-bottom:1px solid #eeeeee;">

<div style="font-size:12px; letter-spacing:3px; color:#888;">
CARD VAULT
</div>

<h1 style="margin:10px 0 5px 0; font-size:24px; font-weight:600; color:#222;">
Order Confirmed
</h1>

<p style="margin:0; font-size:14px; color:#777;">
Thank you for your purchase!
</p>

</td>
</tr>


<!-- GREETING -->

<tr>
<td style="padding:30px;">

<p style="margin:0 0 20px 0; font-size:15px; color:#333; line-height:1.6;">
Dear <strong>${customerName}</strong>,
</p>

<p style="margin:0 0 25px 0; font-size:15px; color:#555; line-height:1.6;">
Your order has been successfully placed. We're processing your order and will notify you once it's ready.
</p>


<!-- ORDER DETAILS -->

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:14px;">

<tr>
<td style="padding:12px 0; font-weight:600; color:#555; width:40%; border-bottom:1px solid #eee;">
Order ID
</td>

<td style="padding:12px 0; color:#222; border-bottom:1px solid #eee;">
${orderId}
</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Order Date
</td>

<td style="padding:12px 0; color:#222; border-bottom:1px solid #eee;">
${orderDate || new Date().toLocaleString()}
</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Total Amount
</td>

<td style="padding:12px 0; font-weight:600; color:#000; border-bottom:1px solid #eee;">
₹${totalPrice}
</td>
</tr>


<tr>
<td style="padding:12px 0; font-weight:600; color:#555; border-bottom:1px solid #eee;">
Status
</td>

<td style="padding:12px 0; border-bottom:1px solid #eee;">

<span style="
padding:5px 10px;
border:1px solid #ccc;
border-radius:4px;
font-size:12px;
font-weight:600;
color:#333;
background:#f7f7f7;
">
Processing
</span>

</td>
</tr>

</table>


<!-- ITEMS -->

<div style="margin-top:25px;">

<div style="font-size:12px; letter-spacing:1px; text-transform:uppercase; color:#777; margin-bottom:10px;">
Order Items
</div>

<div style="background:#fafafa; border:1px solid #eeeeee; border-radius:8px; padding:18px;">

<ul style="margin:0; padding-left:20px; color:#333; line-height:1.6;">
${itemsList}
</ul>

</div>

</div>


<!-- TRACK ORDER BUTTON -->

<tr>
<td align="center" style="padding:30px 30px 0 30px;">

<a href="https://card-vaults.vercel.app/orders"

style="
display:inline-block;
padding:14px 30px;
background:#111;
color:#ffffff;
text-decoration:none;
border-radius:6px;
font-weight:600;
font-size:14px;
">

Check Order Status

</a>

</td>
</tr>


<!-- FOOTER -->

<tr>
<td style="padding:22px 30px; border-top:1px solid #eeeeee; text-align:center; background:#fafafa;">

<div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">
card-vaults.vercel.app
</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>

</td>
</tr>


</table>

<div style="height:40px;"></div>

</td>
</tr>
</table>

</body>
</html>
    `,
  };

  await transporter.sendMail(mailOptions);
};

// Newsletter Email - Sends to all newsletter subscribers when a new product is added
module.exports.sendNewsletterNewProduct = async function (subscribers, productData) {
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const { name, brand, category, price, image, description, id } = productData;
  const frontendUrl = process.env.FRONTEND_URL || 'https://card-vaults.vercel.app';
  const productUrl = `${frontendUrl}/product/${id}`;

  const mailOptions = {
    from: "Card Vault",
    bcc: subscribers.map(sub => sub.email),
    subject: `New Gift Card Available: ${name}`,
    html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5; padding:40px 10px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e6e6e6;">

<!-- HEADER -->

<tr>
<td style="padding:30px; text-align:center; border-bottom:1px solid #eeeeee;">

<div style="font-size:12px; letter-spacing:3px; color:#888;">
CARD VAULT
</div>

<h1 style="margin:10px 0 5px 0; font-size:24px; font-weight:600; color:#222;">
New Gift Card Available
</h1>

<p style="margin:0; font-size:14px; color:#777;">
Check out our latest addition
</p>

</td>
</tr>

<!-- Main Content -->

<tr>
<td style="padding:30px;">

<p style="margin:0 0 20px 0; font-size:15px; color:#333; line-height:1.6;">
Dear Subscriber,
</p>

<p style="margin:0 0 25px 0; font-size:15px; color:#555; line-height:1.6;">
We're excited to announce a new gift card has been added to our collection. Here's what's new:
</p>

<!-- Product Box -->

<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; border:1px solid #eeeeee; border-radius:8px; margin-bottom:24px;">
<tr>
<td style="padding:18px; text-align:center;">

${image ? `<div style="margin-bottom:12px;"><img src="${image}" alt="${name}" style="max-width:120px; height:auto; border-radius:6px;"></div>` : ''}

<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:5px;">
${brand || 'GIFT CARD'}
</div>

<div style="font-size:20px; font-weight:600; color:#222;">
${name}
</div>

${category ? `<div style="font-size:13px; color:#666; margin-top:8px;">${category}</div>` : ''}

<div style="font-size:22px; font-weight:600; color:#222; margin-top:12px;">
${price}
</div>

${description ? `<div style="font-size:13px; color:#666; margin-top:12px; line-height:1.5;">${description.substring(0, 100)}${description.length > 100 ? '...' : ''}</div>` : ''}

</td>
</tr>
</table>


<!-- CTA Button -->

<tr>
<td style="padding:0 30px 30px 30px; text-align:center;">

<a href="${productUrl}" style="display:inline-block; padding:12px 28px; background:#333333; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; border-radius:6px;">
View Details
</a>

</td>
</tr>

<!-- Footer -->

<tr>
<td style="padding:22px 30px; border-top:1px solid #eeeeee; text-align:center; background:#fafafa;">

<div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">card-vaults.vercel.app</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>

</td>
</tr>

</table>

<div style="height:40px;"></div>

</td>
</tr>
</table>

</body>
</html>
`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Newsletter sent to ${subscribers.length} subscribers for product: ${name}`);
    return { success: true, recipientCount: subscribers.length };
  } catch (error) {
    console.error('Newsletter send error:', error);
    throw error;
  }
};
