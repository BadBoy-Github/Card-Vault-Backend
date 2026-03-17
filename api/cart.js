const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Connect to MongoDB
const connectDB = async () => {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/cardvault');
    }
};

// Cart Schema (matching original model)
const cartItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1 }
});

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [cartItemSchema],
    updatedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

// Product Schema (for checking stock)
const productSchema = new mongoose.Schema({
    name: String,
    brand: String,
    price: Number,
    image: String,
    stock: Number
});

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

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
            return res.status(401).json({ message: 'No token provided' });
        }

        // Verify JWT token
        const token = authHeader.replace('Bearer ', '');
        let userId;

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            userId = decoded.id;
        } catch (e) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        if (!userId) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        const userIdObj = new mongoose.Types.ObjectId(userId);

        switch (req.method) {
            case 'GET':
                // Get cart - returns cart directly like original controller
                let cart = await Cart.findOne({ user: userIdObj }).populate('products.product');

                if (!cart) {
                    cart = await Cart.create({ user: userIdObj, products: [] });
                }

                // Filter out products that don't exist or have been deleted
                const validProducts = cart.products.filter(item => item.product !== null);

                // If there were invalid products, update the cart
                if (validProducts.length !== cart.products.length) {
                    cart.products = validProducts;
                    await cart.save();
                }

                // Return cart directly (matching original controller format)
                return res.json(cart);

            case 'POST':
                // Add to cart
                const { productId, quantity = 1 } = req.body;

                // Check if product exists and is in stock
                const product = await Product.findById(productId);
                if (!product) {
                    return res.status(404).json({ message: 'Product not found' });
                }

                if (product.stock < 1) {
                    return res.status(400).json({ message: 'Product is out of stock' });
                }

                let cartToUpdate = await Cart.findOne({ user: userIdObj });

                if (!cartToUpdate) {
                    cartToUpdate = await Cart.create({ user: userIdObj, products: [] });
                }

                // Check if product already in cart
                const productIndex = cartToUpdate.products.findIndex(
                    p => p.product.toString() === productId
                );

                if (productIndex > -1) {
                    // Update quantity
                    const newQuantity = cartToUpdate.products[productIndex].quantity + quantity;

                    // Check stock availability
                    if (newQuantity > product.stock) {
                        return res.status(400).json({ message: `Only ${product.stock} items available in stock` });
                    }

                    cartToUpdate.products[productIndex].quantity = newQuantity;
                } else {
                    // Add new product to cart
                    cartToUpdate.products.push({ product: productId, quantity });
                }

                await cartToUpdate.save();

                const updatedCart = await Cart.findById(cartToUpdate._id).populate('products.product');
                return res.json(updatedCart);

            case 'PUT': {
                // Update quantity - productId in URL path, quantity in body
                const path = req.url.split('?')[0];
                const parts = path.split('/').filter(Boolean);
                let updateProductId = null;

                // Find the index of 'update' and get the next part
                const updateIndex = parts.indexOf('update');
                if (updateIndex !== -1 && updateIndex < parts.length - 1) {
                    updateProductId = parts[updateIndex + 1];
                }

                const { quantity: newQuantity } = req.body;

                if (!updateProductId) {
                    return res.status(400).json({ message: 'Product ID is required' });
                }

                let cart = await Cart.findOne({ user: userIdObj });
                if (!cart) {
                    return res.status(404).json({ message: 'Cart not found' });
                }

                const itemToUpdate = cart.products.find(
                    item => item.product.toString() === updateProductId
                );

                if (itemToUpdate) {
                    itemToUpdate.quantity = newQuantity;
                    await cart.save();
                    const updatedCart = await Cart.findById(cart._id).populate('products.product');
                    return res.json(updatedCart);
                }
                return res.status(404).json({ message: 'Item not found in cart' });
            }

            case 'DELETE': {
                // Extract productId from URL path - format: /api/cart/remove/123 or /cart/remove/123
                const path = req.url.split('?')[0];
                const parts = path.split('/').filter(Boolean);
                let deleteProductId = null;

                // Find the index of 'remove' and get the next part
                const removeIndex = parts.indexOf('remove');
                if (removeIndex !== -1 && removeIndex < parts.length - 1) {
                    deleteProductId = parts[removeIndex + 1];
                }

                let cart = await Cart.findOne({ user: userIdObj });
                if (!cart) {
                    return res.status(404).json({ message: 'Cart not found' });
                }

                if (deleteProductId) {
                    // Remove specific item
                    cart.products = cart.products.filter(
                        item => item.product.toString() !== deleteProductId
                    );
                } else {
                    // Clear entire cart
                    cart.products = [];
                }

                await cart.save();
                const finalCart = await Cart.findById(cart._id).populate('products.product');
                return res.json(finalCart);
            }

            default:
                return res.status(405).json({ message: 'Method not allowed' });
        }
    } catch (error) {
        console.error('Cart API Error:', error);
        return res.status(500).json({ message: error.message });
    }
};
