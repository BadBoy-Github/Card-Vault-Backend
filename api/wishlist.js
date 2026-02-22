const connectDB = require('../_lib/db');
const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

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

export default async function handler(req, res) {
    await connectDB();

    const { method, query, body } = req;
    const user = await getUserFromToken(req);

    if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

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
                // Add to wishlist
                const { productId } = body;

                let wishlist = await Wishlist.findOne({ user: user._id });

                if (!wishlist) {
                    wishlist = await Wishlist.create({ user: user._id, products: [] });
                }

                // Check if product already in wishlist
                const productExists = wishlist.products.find(
                    p => p.product.toString() === productId
                );

                if (productExists) {
                    return res.status(400).json({ message: 'Product already in wishlist' });
                }

                wishlist.products.push({ product: productId });
                await wishlist.save();

                const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products.product');
                return res.status(200).json(updatedWishlist);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                // Remove from wishlist
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
}
