const express = require('express');
const router = express.Router();
const { getCart, addToCart, removeFromCart, updateCartQuantity, clearCart, checkCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

// CORS headers for Vercel
const corsHeaders = (req, res, next) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
};

// Apply CORS to all routes
router.use(corsHeaders);

router.route('/')
    .get(protect, getCart);

router.route('/add')
    .post(protect, addToCart);

router.route('/remove/:productId')
    .delete(protect, removeFromCart);

router.route('/update/:productId')
    .put(protect, updateCartQuantity);

router.route('/clear')
    .delete(protect, clearCart);

router.route('/check/:productId')
    .get(protect, checkCart);

module.exports = router;
