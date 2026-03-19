const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

// Configuration
const EXPIRY_WARNING_DAYS = 30; // Products expiring within this many days will trigger notification
const ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'elayabarathiedison@gmail.com';
const MONGODB_URI = process.env.MONGODB_URI;

// Email transporter
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

// Send expiry notification email
const sendExpiryNotificationEmail = async (expiringProducts) => {
    if (expiringProducts.length === 0) return { success: true, message: 'No expiring products' };

    // Check if SMTP credentials are configured
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('[ExpiryScheduler] SMTP credentials not configured. Email will not be sent.');
        console.log('[ExpiryScheduler] Please configure SMTP_USER and SMTP_PASS in .env file');
        return { success: false, message: 'SMTP credentials not configured' };
    }

    const transporter = createTransporter();

    // Create product list HTML
    const productsList = expiringProducts.map(product => {
        const expiryDate = new Date(product.validityEndDateTime).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        const daysLeft = Math.ceil((new Date(product.validityEndDateTime) - new Date()) / (1000 * 60 * 60 * 24));

        return `
      <tr>
        <td style="padding:12px; border-bottom:1px solid #eee; color:#333;">
          ${product.name}
        </td>
        <td style="padding:12px; border-bottom:1px solid #eee; color:#333;">
          ${product.brand}
        </td>
        <td style="padding:12px; border-bottom:1px solid #eee; color:#333;">
          ${expiryDate}
        </td>
        <td style="padding:12px; border-bottom:1px solid #eee; color:#e74c3c; font-weight:600;">
          ${daysLeft} days left
        </td>
      </tr>
    `;
    }).join('');

    const mailOptions = {
        from: "Card Vault",
        to: ADMIN_EMAIL,
        subject: `⚠️ Product Expiry Alert - ${expiringProducts.length} Product(s) Expiring Soon`,
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
⚠️ Expiry Alert
</h1>

<p style="margin:0; font-size:14px; color:#777;">
Products nearing expiration
</p>

</td>
</tr>


<!-- CONTENT -->

<tr>
<td style="padding:30px;">

<p style="margin:0 0 20px 0; font-size:15px; color:#333; line-height:1.6;">
The following <strong>${expiringProducts.length}</strong> product(s) are expiring within the next 
<strong>${EXPIRY_WARNING_DAYS} days</strong>.
</p>


<!-- PRODUCTS TABLE -->

<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; margin-top:20px; border:1px solid #eeeeee; border-radius:8px; overflow:hidden;">

<thead>

<tr style="background:#fafafa;">

<th style="padding:12px; text-align:left; border-bottom:1px solid #eeeeee; font-size:12px; color:#777; letter-spacing:1px;">
Product Name
</th>

<th style="padding:12px; text-align:left; border-bottom:1px solid #eeeeee; font-size:12px; color:#777; letter-spacing:1px;">
Brand
</th>

<th style="padding:12px; text-align:left; border-bottom:1px solid #eeeeee; font-size:12px; color:#777; letter-spacing:1px;">
Expiry Date
</th>

<th style="padding:12px; text-align:left; border-bottom:1px solid #eeeeee; font-size:12px; color:#777; letter-spacing:1px;">
Time Left
</th>

</tr>

</thead>

<tbody>
${productsList}
</tbody>

</table>


<!-- NOTICE -->

<div style="margin-top:25px; padding:16px; background:#fafafa; border:1px solid #eeeeee; border-left:3px solid #cccccc; border-radius:6px;">

<div style="font-size:13px; font-weight:600; color:#444; margin-bottom:4px;">
Important
</div>

<div style="font-size:12px; color:#666; line-height:1.5;">
These products will expire soon. Please take necessary action before they become invalid.
</div>

</div>


<p style="margin-top:20px; font-size:12px; color:#777; line-height:1.6;">
This is an automated notification sent once per day.
</p>

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
<a href="https://card-vaults.vercel.app" style="color:#555; text-decoration:none;">
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

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[ExpiryScheduler] Email sent successfully for ${expiringProducts.length} expiring products`);
        return { success: true, message: `Email sent for ${expiringProducts.length} products` };
    } catch (error) {
        console.error('[ExpiryScheduler] Error sending email:', error.message);
        return { success: false, message: error.message };
    }
};

// Check for expiring products and send notification
const checkExpiringProducts = async () => {
    try {
        // Connect to MongoDB if not already connected
        if (mongoose.connection.readyState !== 1) {
            if (!MONGODB_URI) {
                console.error('[ExpiryScheduler] MONGODB_URI not configured');
                return [];
            }
            await mongoose.connect(MONGODB_URI);
            console.log('[ExpiryScheduler] Connected to MongoDB');
        }

        // Get Product model - check if already registered, otherwise create a simple one
        let Product;
        try {
            Product = mongoose.model('Product');
        } catch (e) {
            // Model not registered, create a simple schema
            const productSchema = new mongoose.Schema({
                id: String,
                type: String,
                brand: String,
                name: String,
                subheading: String,
                denomination: String,
                value: Number,
                currency: String,
                category: String,
                image: String,
                description: String,
                price: Number,
                createdDateTime: Date,
                validityEndDateTime: Date,
                inStock: Boolean,
                stock: Number,
                popular: Boolean,
            }, { strict: false });
            Product = mongoose.model('Product', productSchema);
        }

        const now = new Date();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + EXPIRY_WARNING_DAYS);

        // Find products that are expiring within the next X days
        // Include all products regardless of stock status (for inventory management)
        const expiringProducts = await Product.find({
            validityEndDateTime: {
                $gte: now,
                $lte: futureDate
            }
        }).lean();

        console.log(`[ExpiryScheduler] Found ${expiringProducts.length} products expiring within ${EXPIRY_WARNING_DAYS} days`);

        if (expiringProducts.length > 0) {
            await sendExpiryNotificationEmail(expiringProducts);
        }

        return expiringProducts;
    } catch (error) {
        console.error('[ExpiryScheduler] Error checking expiring products:', error.message);
        return [];
    }
};

// Vercel API route handler
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

    // Only allow GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        console.log('[ExpiryScheduler] Running expiry check...');
        const products = await checkExpiringProducts();

        res.json({
            success: true,
            message: `Found ${products.length} expiring products`,
            products: products.map(p => ({
                name: p.name,
                brand: p.brand,
                validityEndDateTime: p.validityEndDateTime
            }))
        });
    } catch (error) {
        console.error('[ExpiryScheduler] Error:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
};
