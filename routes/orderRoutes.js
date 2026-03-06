const express = require('express');
const router = express.Router();
const {
    addOrderItems,
    getOrderById,
    getMyOrders,
    getOrders,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    submitUTR,
    verifyPayment,
} = require('../controllers/orderController');
const { protect, admin } = require('../middleware/authMiddleware');

router.route('/').post(protect, addOrderItems).get(protect, admin, getOrders);
router.route('/myorders').get(protect, getMyOrders);
router
    .route('/:id')
    .get(protect, getOrderById)
    .put(protect, admin, updateOrder)
    .delete(protect, admin, deleteOrder);
router.route('/:id/status').put(protect, admin, updateOrderStatus);
router.route('/:id/verify-payment').put(protect, admin, verifyPayment);
router.route('/:id/submit-utr').post(protect, submitUTR);

module.exports = router;
