const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
    },
    type: {
        type: String,
        enum: ['regular', 'featured'],
        default: 'regular',
    },
    brand: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        required: true,
    },
    subheading: {
        type: String,
        default: null,
    },
    denomination: String,
    value: {
        type: Number,
        required: true,
    },
    currency: {
        type: String,
        default: 'INR',
    },
    category: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        required: true,
    },
    description: String,
    price: {
        type: Number,
        required: true,
    },
    createdDateTime: {
        type: Date,
        default: Date.now,
    },
    validityEndDateTime: Date,
    inStock: {
        type: Boolean,
        default: true,
    },
    stock: {
        type: Number,
        default: 1,
    },
    popular: {
        type: Boolean,
        default: false,
    },
});

module.exports = mongoose.model('Product', productSchema);
