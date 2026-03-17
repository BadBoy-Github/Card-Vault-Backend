const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Import services
const { startExpiryScheduler, checkExpiringProducts } = require('./services/expiryScheduler');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
// CORS configuration for Vercel deployment
const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        // Also allow localhost for development
        const allowedOrigins = [
            'http://localhost:5173',
            'http://localhost:3000',
            'https://card-vault-frontend.vercel.app',
            'https://card-vaults.vercel.app',
        ];

        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// DB Connection
const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected successfully');
    } catch (err) {
        console.error('MongoDB connection error:', err.message);
        process.exit(1);
    }
};

connectDB();

// Start the expiry notification scheduler
startExpiryScheduler();

// Basic Route
app.get('/', (req, res) => {
    res.send('Card Vault API is running...');
});

// Sitemap Route
app.get('/sitemap.xml', async (req, res) => {
    try {
        const Product = require('./models/Product');
        const products = await Product.find({ active: true }).limit(1000).lean();

        const today = new Date().toISOString().split('T')[0];
        const baseUrl = 'https://card-vaults.vercel.app';

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
`;

        // Static pages - matching frontend routes
        const staticPages = [
            { url: '/', priority: '1.0', freq: 'daily' },
            { url: '/search', priority: '0.9', freq: 'daily' },
            { url: '/featured-product/example', priority: '0.8', freq: 'weekly' },
            { url: '/product/example', priority: '0.7', freq: 'weekly' },
            { url: '/wishlist', priority: '0.8', freq: 'weekly' },
            { url: '/cart', priority: '0.8', freq: 'weekly' },
            { url: '/orders', priority: '0.8', freq: 'weekly' },
            { url: '/profile', priority: '0.7', freq: 'monthly' },
            { url: '/login', priority: '0.5', freq: 'yearly' },
            { url: '/register', priority: '0.5', freq: 'yearly' },
            { url: '/terms', priority: '0.6', freq: 'monthly' },
            { url: '/forgot-password', priority: '0.3', freq: 'yearly' }
        ];

        staticPages.forEach(page => {
            xml += `  <url>
    <loc>${baseUrl}${page.url}</loc>
    <changefreq>${page.freq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${today}</lastmod>
  </url>\n`;
        });

        // Product pages
        products.forEach(product => {
            xml += `  <url>
    <loc>${baseUrl}/product/${product._id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <lastmod>${today}</lastmod>\n`;
            if (product.image) {
                xml += `    <image:image>
      <image:loc>${product.image}</image:loc>
      <image:title>${product.name}</image:title>
    </image:image>\n`;
            }
            xml += `  </url>\n`;
        });

        xml += '</urlset>';

        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600');
        res.send(xml);
    } catch (error) {
        console.error('Sitemap error:', error);
        // Fallback to static sitemap
        res.redirect('/sitemap.xml');
    }
});

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/payment', require('./api/payment'));
app.use('/api/newsletter', require('./api/newsletter'));
app.use('/api/sitemap', require('./api/sitemap'));

// Manual trigger endpoint for expiry check (for testing)
// Supports both GET (for Vercel cron) and POST (for manual testing)
app.post('/api/trigger-expiry-check', async (req, res) => {
    try {
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
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/trigger-expiry-check', async (req, res) => {
    try {
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
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
