const connectDB = require('../_lib/db');
const Order = require('../_models/Order');
const jwt = require('jsonwebtoken');

// Helper to get user from token
const getUserFromToken = async (req) => {
    let user = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const User = require('../_models/User');
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

    const user = await getUserFromToken(req);

    if (!user) {
        return res.status(401).json({ message: 'Not authorized' });
    }

    if (req.method === 'GET') {
        try {
            const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
            return res.status(200).json(orders);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
};
