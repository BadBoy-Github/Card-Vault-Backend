const mongoose = require('mongoose');

// Connect to MongoDB
const connectDB = async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cardvault');
    }
};

// Cart Schema
const cartItemSchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: String,
    brand: String,
    price: Number,
    image: String,
    quantity: { type: Number, default: 1 },
    validityEndDateTime: Date
});

const cartSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [cartItemSchema],
    updatedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

// CORS headers
const corsHeaders = (res, origin = '*') => {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
};

module.exports = async function handler(req, res) {
    const origin = req.headers.origin || '*';
    corsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    try {
        await connectDB();

        // Get auth token from header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ success: false, message: 'No token provided' });
        }

        // Simple JWT verification (in production, use proper JWT verification)
        const token = authHeader.replace('Bearer ', '');
        let userId;

        try {
            // Decode base64 token (simple encoding for demo)
            const decoded = Buffer.from(token, 'base64').toString();
            const userData = JSON.parse(decoded);
            userId = userData.id || userData._id;
        } catch (e) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Invalid token' });
        }

        switch (req.method) {
            case 'GET':
                // Get cart
                let cart = await Cart.findOne({ userId });
                if (!cart) {
                    cart = new Cart({ userId, items: [] });
                    await cart.save();
                }
                return res.status(200).json({ success: true, cart });

            case 'POST':
                // Add to cart
                const { productId, name, brand, price, image, quantity = 1, validityEndDateTime } = req.body;

                cart = await Cart.findOne({ userId });
                if (!cart) {
                    cart = new Cart({ userId, items: [] });
                }

                const existingItemIndex = cart.items.findIndex(
                    item => item.productId.toString() === productId
                );

                if (existingItemIndex > -1) {
                    cart.items[existingItemIndex].quantity += quantity;
                } else {
                    cart.items.push({
                        productId,
                        name,
                        brand,
                        price,
                        image,
                        quantity,
                        validityEndDateTime
                    });
                }

                cart.updatedAt = new Date();
                await cart.save();
                return res.status(200).json({ success: true, cart });

            case 'PUT':
                // Update quantity
                const { productId: updateProductId, quantity: newQuantity } = req.body;

                cart = await Cart.findOne({ userId });
                if (!cart) {
                    return res.status(404).json({ success: false, message: 'Cart not found' });
                }

                const itemToUpdate = cart.items.find(
                    item => item.productId.toString() === updateProductId
                );

                if (itemToUpdate) {
                    itemToUpdate.quantity = newQuantity;
                    cart.updatedAt = new Date();
                    await cart.save();
                    return res.status(200).json({ success: true, cart });
                }
                return res.status(404).json({ success: false, message: 'Item not found in cart' });

            case 'DELETE':
                const { productId: deleteProductId } = req.query;

                cart = await Cart.findOne({ userId });
                if (!cart) {
                    return res.status(404).json({ success: false, message: 'Cart not found' });
                }

                if (deleteProductId) {
                    // Remove specific item
                    cart.items = cart.items.filter(
                        item => item.productId.toString() !== deleteProductId
                    );
                } else {
                    // Clear entire cart
                    cart.items = [];
                }

                cart.updatedAt = new Date();
                await cart.save();
                return res.status(200).json({ success: true, cart });

            default:
                return res.status(405).json({ success: false, message: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Cart API Error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};
