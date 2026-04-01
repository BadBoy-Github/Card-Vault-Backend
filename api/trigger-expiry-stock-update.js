const mongoose = require('mongoose');

// Configuration
const MONGODB_URI = process.env.MONGODB_URI;

// Update expired products to have stock = 0
const updateExpiredProductsStock = async () => {
    try {
        // Connect to MongoDB if not already connected
        if (mongoose.connection.readyState !== 1) {
            if (!MONGODB_URI) {
                console.error('[TriggerExpiryStockUpdate] MONGODB_URI not configured');
                return { modifiedCount: 0 };
            }
            await mongoose.connect(MONGODB_URI);
            console.log('[TriggerExpiryStockUpdate] Connected to MongoDB');
        }

        // Get Product model
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

        // Find all expired products that still have stock > 0 or inStock = true
        const expiredProducts = await Product.find({
            validityEndDateTime: { $lt: now },
            $or: [
                { inStock: true },
                { stock: { $gte: 1 } }
            ]
        });

        if (expiredProducts.length === 0) {
            console.log('[TriggerExpiryStockUpdate] No expired products with stock to update');
            return { modifiedCount: 0 };
        }

        // Update all expired products to have stock = 0 and inStock = false
        const result = await Product.updateMany(
            {
                validityEndDateTime: { $lt: now },
                $or: [
                    { inStock: true },
                    { stock: { $gte: 1 } }
                ]
            },
            {
                $set: {
                    stock: 0,
                    inStock: false
                }
            }
        );

        console.log(`[TriggerExpiryStockUpdate] Updated ${result.modifiedCount} expired products to stock = 0`);
        return result;
    } catch (error) {
        console.error('[TriggerExpiryStockUpdate] Error updating expired products stock:', error.message);
        return { modifiedCount: 0 };
    }
};

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

    // Allow both GET and POST methods
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const result = await updateExpiredProductsStock();
        return res.status(200).json({
            success: true,
            message: `Updated ${result.modifiedCount} expired products to stock = 0`,
            modifiedCount: result.modifiedCount
        });
    } catch (error) {
        console.error('[TriggerExpiryStockUpdate] Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
