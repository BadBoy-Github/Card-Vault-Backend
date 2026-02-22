const connectDB = require('../_lib/db');
const Product = require('../_models/Product');
const jwt = require('jsonwebtoken');

// Helper to get user from token
const getUserFromToken = (req) => {
    let user = null;
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            user = decoded;
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
    const tokenUser = getUserFromToken(req);
    const { id } = query;

    switch (method) {
        case 'GET':
            try {
                const product = await Product.findOne({ id: id });
                if (product) {
                    return res.status(200).json(product);
                } else {
                    return res.status(404).json({ message: 'Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'PUT':
            try {
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const User = require('../_models/User');
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const product = await Product.findOne({ id: id });
                if (product) {
                    const updatedProduct = await Product.findOneAndUpdate(
                        { id: id },
                        body,
                        { new: true }
                    );
                    return res.status(200).json(updatedProduct);
                } else {
                    return res.status(404).json({ message: 'Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const User = require('../_models/User');
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const result = await Product.deleteOne({ id: id });
                if (result.deletedCount > 0) {
                    return res.status(200).json({ message: 'Product removed' });
                } else {
                    return res.status(404).json({ message: 'Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
