const connectDB = require('./_lib/db');
const Product = require('./_models/Product');
const jwt = require('jsonwebtoken');
const User = require('./_models/User');
const Newsletter = require('./_models/Newsletter');
const { sendNewsletterNewProduct } = require('./email');
const nodemailer = require('nodemailer');

// Expiry check configuration
const EXPIRY_WARNING_DAYS = 30;
const ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'elayabarathiedison@gmail.com';

// Email transporter for expiry notifications
const createExpiryTransporter = () => {
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

    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.error('[ExpiryScheduler] SMTP credentials not configured');
        return { success: false, message: 'SMTP credentials not configured' };
    }

    const transporter = createExpiryTransporter();

    const productsList = expiringProducts.map(product => {
        const expiryDate = new Date(product.validityEndDateTime).toLocaleDateString('en-IN', {
            year: 'numeric', month: 'long', day: 'numeric'
        });
        const daysLeft = Math.ceil((new Date(product.validityEndDateTime) - new Date()) / (1000 * 60 * 60 * 24));
        return `<tr>
            <td style="padding:12px 0; border-bottom:1px solid #eee; color:#333;">${product.name}</td>
            <td style="padding:12px 0; border-bottom:1px solid #eee; color:#333;">${product.brand}</td>
            <td style="padding:12px 0; border-bottom:1px solid #eee; color:#333;">${expiryDate}</td>
            <td style="padding:12px 0; border-bottom:1px solid #eee; color:#e74c3c; font-weight:600;">${daysLeft} days left</td>
        </tr>`;
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
The following <strong>${expiringProducts.length}</strong> product(s) are expiring within the next <strong>${EXPIRY_WARNING_DAYS} days</strong>.
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
    `};

    try {
        await transporter.sendMail(mailOptions);
        console.log(`[ExpiryScheduler] Email sent for ${expiringProducts.length} products`);
        return { success: true, message: `Email sent for ${expiringProducts.length} products` };
    } catch (error) {
        console.error('[ExpiryScheduler] Error sending email:', error.message);
        return { success: false, message: error.message };
    }
};

// Check expiring products
const checkExpiringProducts = async () => {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + EXPIRY_WARNING_DAYS);

    const expiringProducts = await Product.find({
        validityEndDateTime: { $gte: now, $lte: futureDate }
    }).lean();

    console.log(`[ExpiryScheduler] Found ${expiringProducts.length} products expiring within ${EXPIRY_WARNING_DAYS} days`);

    if (expiringProducts.length > 0) {
        await sendExpiryNotificationEmail(expiringProducts);
    }

    return expiringProducts;
};

// Generate a 9-character alphanumeric ID with uppercase, lowercase, and numbers
const generateProductId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 9; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
};

// Generate unique product ID by checking database
const generateUniqueProductId = async (productType = 'regular') => {
    let id;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 100; // Safety limit

    while (exists && attempts < maxAttempts) {
        id = generateProductId();
        const existingProduct = await Product.findOne({ id, type: productType });
        exists = !!existingProduct;
        attempts++;
    }

    if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique product ID after maximum attempts');
    }

    return id;
};

// Helper to get user from token
const getUserFromToken = (req) => {
    let user = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            user = decoded;
        } catch (e) {
            // Invalid token
        }
    }
    return user;
};

// CORS headers
function corsHeaders(req) {
    const origin = req.headers.origin || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}

// Extract product ID from URL path
const getProductIdFromPath = (url) => {
    const path = url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    // Path is like /api/products/123 or /products/123
    if (parts.length >= 3 && parts[parts.length - 1] !== 'products') {
        return parts[parts.length - 1];
    }
    return null;
};

module.exports = async function handler(req, res) {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        const headers = corsHeaders(req);
        Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));
        return res.status(204).end();
    }

    // Set CORS headers for all responses
    const headers = corsHeaders(req);
    Object.keys(headers).forEach(key => res.setHeader(key, headers[key]));

    await connectDB();

    const { method, query, body } = req;
    const tokenUser = getUserFromToken(req);

    // Get product ID from path or query
    const productId = getProductIdFromPath(req.url) || query.id;

    // Determine product type (regular, featured, or all)
    const productType = query.type === 'featured' ? 'featured' : (query.type === 'all' ? 'all' : 'regular');

    // Check if this is a request for a new product ID preview
    if (method === 'GET' && query.generateId === 'true') {
        try {
            const newId = await generateUniqueProductId(productType);
            return res.status(200).json({ id: newId });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    switch (method) {
        case 'GET':
            try {
                // Check for expiry check trigger (for Vercel cron) - check in both query and URL
                const expiryCheckInQuery = query && query.triggerExpiryCheck === 'true';
                const expiryCheckInUrl = req.url && req.url.includes('triggerExpiryCheck=true');
                console.log('[DEBUG] req.url:', req.url, 'query:', JSON.stringify(query));
                if (expiryCheckInQuery || expiryCheckInUrl) {
                    console.log('[ExpiryScheduler] Running expiry check...');
                    const products = await checkExpiringProducts();
                    return res.json({
                        success: true,
                        message: `Found ${products.length} expiring products`,
                        products: products.map(p => ({
                            name: p.name,
                            brand: p.brand,
                            validityEndDateTime: p.validityEndDateTime
                        }))
                    });
                }

                // Get single product by ID or all products
                if (productId) {
                    const product = await Product.findOne({ id: productId });
                    if (product) {
                        return res.status(200).json(product);
                    } else {
                        return res.status(404).json({ message: 'Product not found' });
                    }
                } else {
                    // Check for search query
                    const searchQuery = query.search;
                    let products;

                    // Build filter based on type
                    let filter = {};
                    if (productType === 'featured') {
                        filter = { type: 'featured' };
                    } else if (productType === 'regular') {
                        filter = { type: { $ne: 'featured' } };
                    }
                    // For 'all' type, filter is empty (returns all products)

                    // Build sort option
                    let sortOption = { name: 1 }; // Default: alphabetical ascending
                    const sortParam = query.sort;
                    if (sortParam === 'name-asc') {
                        sortOption = { name: 1 };
                    } else if (sortParam === 'name-desc') {
                        sortOption = { name: -1 };
                    } else if (sortParam === 'price-asc') {
                        sortOption = { price: 1 };
                    } else if (sortParam === 'price-desc') {
                        sortOption = { price: -1 };
                    }

                    if (searchQuery) {
                        // Search by name, brand, category, description, or subheading
                        const searchRegex = new RegExp(searchQuery, 'i');
                        products = await Product.find({
                            ...filter,
                            $or: [
                                { name: searchRegex },
                                { brand: searchRegex },
                                { category: searchRegex },
                                { description: searchRegex },
                                { subheading: searchRegex }
                            ]
                        }).sort(sortOption);
                    } else {
                        products = await Product.find(filter).sort(sortOption);
                    }

                    return res.status(200).json(products);
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'POST':
            try {
                // Check if admin
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const {
                    brand,
                    name,
                    subheading,
                    denomination,
                    category,
                    image,
                    description,
                    price,
                    validityEndDateTime,
                    stock,
                    popular,
                    type, // Allow specifying type in body
                } = body;

                // Determine product type
                const productTypeFromBody = type === 'featured' ? 'featured' : 'regular';

                // Generate unique product ID
                const productId = await generateUniqueProductId(productTypeFromBody);

                const product = new Product({
                    id: productId,
                    type: productTypeFromBody,
                    brand,
                    name,
                    subheading: productTypeFromBody === 'featured' ? subheading : null,
                    denomination,
                    value: price, // Use price as value
                    category,
                    image,
                    description,
                    price,
                    validityEndDateTime,
                    stock,
                    popular,
                });

                const createdProduct = await product.save();

                // Send newsletter to all subscribers about the new product (async, don't wait)
                try {
                    const subscribers = await Newsletter.find({ isActive: true }).select('email name');
                    if (subscribers && subscribers.length > 0) {
                        // Send newsletter in background
                        sendNewsletterNewProduct(subscribers, {
                            name: createdProduct.name,
                            subheading: createdProduct.subheading,
                            brand: createdProduct.brand,
                            category: createdProduct.category,
                            price: createdProduct.price,
                            image: createdProduct.image,
                            description: createdProduct.description,
                            id: createdProduct.id
                        }).then(() => {
                            console.log(`Newsletter sent for new product: ${createdProduct.name}`);
                        }).catch(err => {
                            console.error('Failed to send newsletter:', err);
                        });
                    }
                } catch (newsletterError) {
                    console.error('Error sending newsletter:', newsletterError);
                    // Don't fail the product creation if newsletter fails
                }

                return res.status(201).json(createdProduct);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'PUT':
            try {
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const product = await Product.findOne({ id: productId });
                if (product) {
                    product.brand = body.brand || product.brand;
                    product.name = body.name || product.name;
                    product.subheading = body.subheading !== undefined ? body.subheading : product.subheading;
                    product.denomination = body.denomination || product.denomination;
                    product.value = body.value || product.value;
                    product.category = body.category || product.category;
                    product.image = body.image || product.image;
                    product.description = body.description || product.description;
                    product.price = body.price || product.price;
                    product.validityEndDateTime = body.validityEndDateTime || product.validityEndDateTime;
                    product.stock = body.stock !== undefined ? body.stock : product.stock;
                    product.popular = body.popular !== undefined ? body.popular : product.popular;
                    product.inStock = body.stock > 0;

                    const updatedProduct = await product.save();
                    return res.status(200).json(updatedProduct);
                } else {
                    return res.status(404).json({ message: 'Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const result = await Product.deleteOne({ id: productId });
                if (result.deletedCount > 0) {
                    return res.status(200).json({ message: 'Product removed' });
                } else {
                    return res.status(404).json({ message: 'Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
