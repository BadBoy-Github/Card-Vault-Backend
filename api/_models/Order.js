const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String,
        enum: ['regular', 'featured'],
        default: 'regular',
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
            },
            featuredProduct: {
                type: mongoose.Schema.ObjectId,
                ref: 'Product',
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
    // Gift Card fields - for regular orders (16 digit + 6 digit PIN)
    giftCardNumber: {
        type: String,
        default: null,
    },
    giftCardPin: {
        type: String,
        default: null,
    },
    giftCardExpiryDate: {
        type: String,
        default: null,
    },
    // Gift Card Code - for featured orders (variable length code)
    giftCardCode: {
        type: String,
        default: null,
    },
    giftCardSentAt: {
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
