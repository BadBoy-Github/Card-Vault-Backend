const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Import services
const { startExpiryScheduler, checkExpiringProducts, updateExpiredProductsStock } = require('./services/expiryScheduler');

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


// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/products', require('./routes/productRoutes'));
app.use('/api/orders', require('./routes/orderRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/cart', require('./routes/cartRoutes'));
app.use('/api/newsletter', require('./api/newsletter'));

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

// Manual trigger endpoint for updating expired products stock (for testing)
// Supports both GET (for Vercel cron) and POST (for manual testing)
app.post('/api/trigger-expiry-stock-update', async (req, res) => {
    try {
        const result = await updateExpiredProductsStock();
        res.json({
            success: true,
            message: `Updated ${result.modifiedCount} expired products to stock = 0`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/trigger-expiry-stock-update', async (req, res) => {
    try {
        const result = await updateExpiredProductsStock();
        res.json({
            success: true,
            message: `Updated ${result.modifiedCount} expired products to stock = 0`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
