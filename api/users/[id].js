const connectDB = require('../_lib/db');
const User = require('../_models/User');
const jwt = require('jsonwebtoken');

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

    const { method, query, body } = req;
    const user = await getUserFromToken(req);
    const { id } = query;

    const isAdmin = user && user.role === 'admin';

    switch (method) {
        case 'GET':
            try {
                if (!isAdmin) {
                    return res.status(403).json({ message: 'Not authorized as admin' });
                }
                const foundUser = await User.findById(id).select('-password');
                if (foundUser) {
                    return res.status(200).json(foundUser);
                }
                return res.status(404).json({ message: 'User not found' });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'PUT':
            try {
                if (!isAdmin) {
                    return res.status(403).json({ message: 'Not authorized as admin' });
                }
                const updatedUser = await User.findByIdAndUpdate(id, body, {
                    new: true,
                }).select('-password');
                if (updatedUser) {
                    return res.status(200).json(updatedUser);
                }
                return res.status(404).json({ message: 'User not found' });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                if (!isAdmin) {
                    return res.status(403).json({ message: 'Not authorized as admin' });
                }
                const deletedUser = await User.findByIdAndDelete(id);
                if (deletedUser) {
                    return res.status(200).json({ message: 'User removed' });
                }
                return res.status(404).json({ message: 'User not found' });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
