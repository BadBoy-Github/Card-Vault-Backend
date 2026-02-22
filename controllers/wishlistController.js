const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// @desc    Get user wishlist
// @route   GET /api/wishlist
// @access  Private
const getWishlist = async (req, res) => {
    try {
        let wishlist = await Wishlist.findOne({ user: req.user._id }).populate('products.product');

        if (!wishlist) {
            wishlist = await Wishlist.create({ user: req.user._id, products: [] });
        }

        // Filter out products that don't exist or have been deleted
        const validProducts = wishlist.products.filter(item => item.product !== null);

        // If there were invalid products, update the wishlist
        if (validProducts.length !== wishlist.products.length) {
            wishlist.products = validProducts;
            await wishlist.save();
        }

        res.json(wishlist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add product to wishlist
// @route   POST /api/wishlist/add
// @access  Private
const addToWishlist = async (req, res) => {
    const { productId } = req.body;

    try {
        let wishlist = await Wishlist.findOne({ user: req.user._id });

        if (!wishlist) {
            wishlist = await Wishlist.create({ user: req.user._id, products: [] });
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
        res.json(updatedWishlist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Remove product from wishlist
// @route   DELETE /api/wishlist/remove/:productId
// @access  Private
const removeFromWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ user: req.user._id });

        if (!wishlist) {
            return res.status(404).json({ message: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(
            p => p.product.toString() !== req.params.productId
        );

        await wishlist.save();

        const updatedWishlist = await Wishlist.findById(wishlist._id).populate('products.product');
        res.json(updatedWishlist);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
const checkWishlist = async (req, res) => {
    try {
        const wishlist = await Wishlist.findOne({ user: req.user._id });

        if (!wishlist) {
            return res.json({ isInWishlist: false });
        }

        const isInWishlist = wishlist.products.some(
            p => p.product.toString() === req.params.productId
        );

        res.json({ isInWishlist });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist,
    checkWishlist,
};
