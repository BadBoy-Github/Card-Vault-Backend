const mongoose = require('mongoose');

const newsletterSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.ObjectId,
        ref: 'User',
        default: null, // null for non-logged-in users
    },
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    age: {
        type: Number,
        default: null,
    },
    phone: {
        type: String,
        default: null,
    },
    likedCategories: [{
        type: String,
    }],
    subscribedAt: {
        type: Date,
        default: Date.now,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
});

// Prevent duplicate subscriptions
newsletterSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('Newsletter', newsletterSchema);
