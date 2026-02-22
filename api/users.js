const connectDB = require('../_lib/db');
const User = require('../models/User');
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

export default async function handler(req, res) {
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

    const isAdmin = user && user.role === 'admin';

    switch (method) {
        case 'GET':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }

                // Get all users (admin only)
                if (query.id === 'all' && isAdmin) {
                    const users = await User.find({}).select('-password');
                    return res.status(200).json(users);
                }

                // Get single user (admin only)
                if (query.id && isAdmin) {
                    const userToFind = await User.findById(query.id).select('-password');
                    if (userToFind) {
                        return res.status(200).json(userToFind);
                    } else {
                        return res.status(404).json({ message: 'User not found' });
                    }
                }

                // Get current user profile
                return res.status(200).json({
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'PUT':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }

                // Update user profile
                const { name, email, password } = body;

                const userToUpdate = await User.findById(query.id || user._id);

                if (!userToUpdate) {
                    return res.status(404).json({ message: 'User not found' });
                }

                // Check if user is updating themselves or is admin
                if (userToUpdate._id.toString() !== user._id.toString() && !isAdmin) {
                    return res.status(403).json({ message: 'Not authorized' });
                }

                if (name) userToUpdate.name = name;
                if (email) userToUpdate.email = email;
                if (password) userToUpdate.password = password;

                const updatedUser = await userToUpdate.save();

                return res.status(200).json({
                    _id: updatedUser._id,
                    name: updatedUser.name,
                    email: updatedUser.email,
                    role: updatedUser.role,
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                if (!user || !isAdmin) {
                    return res.status(403).json({ message: 'Not authorized as admin' });
                }

                const userToDelete = await User.findById(query.id);

                if (userToDelete) {
                    await userToDelete.deleteOne();
                    return res.status(200).json({ message: 'User removed' });
                } else {
                    return res.status(404).json({ message: 'User not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
}
