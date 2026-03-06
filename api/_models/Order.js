const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    orderItems: [
        {
            name: { type: String, required: true },
            brand: { type: String, required: true },
            price: { type: Number, required: true },
            image: { type: String, required: true },
            qty: { type: Number, required: true, default: 1 },
            product: {
                type: mongoose.Schema.ObjectId,
                ref: 'Product',
                required: true,
            },
        },
    ],
    status: {
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending',
    },
    // Payment fields
    paymentStatus: {
        type: String,
        enum: ['pending', 'awaiting_verification', 'verified', 'failed'],
        default: 'pending',
    },
    utrNumber: {
        type: String,
        default: null,
    },
    paymentAmount: {
        type: Number,
        default: null,
    },
    paymentMethod: {
        type: String,
        default: 'UPI',
    },
    paymentSubmittedAt: {
        type: Date,
        default: null,
    },
    verifiedAt: {
        type: Date,
        default: null,
    },
    totalPrice: {
        type: Number,
        required: true,
        default: 0.0,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Order', orderSchema);
