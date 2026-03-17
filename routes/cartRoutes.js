const express = require('express');
const router = express.Router();
const { getCart, addToCart, removeFromCart, updateCartQuantity, clearCart, checkCart } = require('../controllers/cartController');
const { protect } = require('../middleware/authMiddleware');

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
