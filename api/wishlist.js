const connectDB = require('./_lib/db');
const Wishlist = require('./_models/Wishlist');
const Product = require('./_models/Product');
const jwt = require('jsonwebtoken');
const User = require('./_models/User');
const mongoose = require('mongoose');

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

// CORS headers
function corsHeaders(req) {
    const origin = req.headers.origin || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };
}

// Parse URL path to determine route
const parsePath = (url) => {
    const path = url.split('?')[0];
    const parts = path.split('/').filter(Boolean);

    // /api/wishlist/add or /wishlist/add
    if (parts.includes('add')) {
        return { action: 'add' };
    }

    // /api/wishlist/remove/123 or /wishlist/remove/123
    if (parts.includes('remove')) {
        const removeIndex = parts.indexOf('remove');
        if (removeIndex < parts.length - 1) {
            return { action: 'remove', productId: parts[removeIndex + 1] };
        }
    }

    return { action: 'wishlist' };
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

    const { method, body, query } = req;
    const user = await getUserFromToken(req);
    const { action, productId: pathProductId } = parsePath(req.url);

    if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    // Handle add route
    if (action === 'add') {
        if (method !== 'POST') {
            return res.status(405).json({ message: 'Method not allowed' });
        }
        try {
            const { productId } = body;
            console.log('Wishlist add request - productId:', productId);

            // Check if product exists - try both id (9-char) and _id (MongoDB ObjectId)
            let product = await Product.findOne({ id: productId });
            console.log('Found by id:', product);
            if (!product) {
                // Try finding by _id using mongoose ObjectId
                try {
                    product = await Product.findOne({ _id: new mongoose.Types.ObjectId(productId) });
                } catch (e) {
                    console.log('Invalid ObjectId format:', productId);
                }
                console.log('Found by _id:', product);
            }
            if (!product) {
                console.log('Product not found for productId:', productId);
                return res.status(404).json({ message: 'Product not found' });
            }

            let wishlist = await Wishlist.findOne({ user: user._id });

            if (!wishlist) {
                wishlist = await Wishlist.create({ user: user._id, products: [] });
            }

            // Check if product already in wishlist
            const productExists = wishlist.products.find(
                p => p.product.toString() === product._id.toString()
            );

            if (productExists) {
                return res.status(400).json({ message: 'Product already in wishlist' });
            }

            wishlist.products.push({ product: product._id });
            await wishlist.save();

            const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products.product');
            return res.status(200).json(updatedWishlist);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    // Handle remove route
    if (action === 'remove') {
        if (method !== 'DELETE') {
            return res.status(405).json({ message: 'Method not allowed' });
        }
        try {
            const productId = pathProductId;

            // Find the product to get its _id
            let product = await Product.findOne({ id: productId });
            if (!product) {
                product = await Product.findOne({ _id: productId });
            }

            const wishlist = await Wishlist.findOne({ user: user._id });

            if (!wishlist) {
                return res.status(404).json({ message: 'Wishlist not found' });
            }

            // Use the product's _id if found, otherwise use the raw productId
            const removeId = product ? product._id.toString() : productId;
            wishlist.products = wishlist.products.filter(
                p => p.product.toString() !== removeId
            );

            await wishlist.save();

            const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products.product');
            return res.status(200).json(updatedWishlist);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    // Handle main wishlist route
    switch (method) {
        case 'GET':
            try {
                // Check if product exists (for check endpoint)
                if (query.productId) {
                    const wishlist = await Wishlist.findOne({ user: user._id });
                    if (!wishlist) {
                        return res.status(200).json({ isInWishlist: false });
                    }
                    const isInWishlist = wishlist.products.some(
                        p => p.product.toString() === query.productId
                    );
                    return res.status(200).json({ isInWishlist });
                }

                // Get full wishlist
                let wishlist = await Wishlist.findOne({ user: user._id }).populate('products.product');

                if (!wishlist) {
                    wishlist = await Wishlist.create({ user: user._id, products: [] });
                }

                // Filter out products that don't exist or have been deleted
                const validProducts = wishlist.products.filter(item => item.product !== null);

                // If there were invalid products, update the wishlist
                if (validProducts.length !== wishlist.products.length) {
                    wishlist.products = validProducts;
                    await wishlist.save();
                }

                return res.status(200).json(wishlist);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'POST':
            try {
                // Add to wishlist (alternative endpoint)
                const { productId } = body;

                // Find the product to get its _id - try both id formats
                let product = await Product.findOne({ id: productId });
                if (!product) {
                    product = await Product.findOne({ _id: productId });
                }
                if (!product) {
                    return res.status(404).json({ message: 'Product not found' });
                }

                let wishlist = await Wishlist.findOne({ user: user._id });

                if (!wishlist) {
                    wishlist = await Wishlist.create({ user: user._id, products: [] });
                }

                // Check if product already in wishlist
                const productExists = wishlist.products.find(
                    p => p.product.toString() === product._id.toString()
                );

                if (productExists) {
                    return res.status(400).json({ message: 'Product already in wishlist' });
                }

                wishlist.products.push({ product: product._id });
                await wishlist.save();

                const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products.product');
                return res.status(200).json(updatedWishlist);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                // Remove from wishlist (alternative endpoint)
                const { productId } = query;

                const wishlist = await Wishlist.findOne({ user: user._id });

                if (!wishlist) {
                    return res.status(404).json({ message: 'Wishlist not found' });
                }

                wishlist.products = wishlist.products.filter(
                    p => p.product.toString() !== productId
                );

                await wishlist.save();

                const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products.product');
                return res.status(200).json(updatedWishlist);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
