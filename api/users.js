const connectDB = require('./_lib/db');
const User = require('./_models/User');
const jwt = require('jsonwebtoken');

// Default admin email that cannot be deleted or have role changed
const DEFAULT_ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'elayabarathiedison@gmail.com';

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

// Extract user ID from URL path
const getUserIdFromPath = (url) => {
    const path = url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    // Path is like /api/users/123 or /users/123
    if (parts.length >= 3 && parts[parts.length - 1] !== 'users') {
        return parts[parts.length - 1];
    }
    return null;
};

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

    const { method, body } = req;
    const user = await getUserFromToken(req);

    // Get user ID from path or query
    const userId = getUserIdFromPath(req.url);

    const isAdmin = user && user.role === 'admin';

    // Handle single user routes
    if (userId) {
        switch (method) {
            case 'GET':
                try {
                    if (!isAdmin) {
                        return res.status(403).json({ message: 'Not authorized as admin' });
                    }
                    const userToFind = await User.findById(userId).select('-password');
                    if (userToFind) {
                        return res.status(200).json(userToFind);
                    }
                    return res.status(404).json({ message: 'User not found' });
                } catch (error) {
                    return res.status(500).json({ message: error.message });
                }

            case 'PUT':
                try {
                    if (!user) {
                        return res.status(401).json({ message: 'Not authorized' });
                    }

                    const userToUpdate = await User.findById(userId);

                    if (!userToUpdate) {
                        return res.status(404).json({ message: 'User not found' });
                    }

                    // Check if user is updating themselves or is admin
                    if (userToUpdate._id.toString() !== user._id.toString() && !isAdmin) {
                        return res.status(403).json({ message: 'Not authorized' });
                    }

                    const { name, email, password, role } = body;

                    // Protect default admin from role changes
                    const isDefaultAdmin = userToUpdate.email === DEFAULT_ADMIN_EMAIL;

                    if (name) userToUpdate.name = name;
                    if (email) userToUpdate.email = email;
                    if (password) userToUpdate.password = password;
                    // Only allow role change if not default admin
                    if (role && isAdmin && !isDefaultAdmin) userToUpdate.role = role;

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
                    if (!isAdmin) {
                        return res.status(403).json({ message: 'Not authorized as admin' });
                    }

                    const userToDelete = await User.findById(userId);

                    if (userToDelete) {
                        // Protect default admin from deletion
                        if (userToDelete.email === DEFAULT_ADMIN_EMAIL) {
                            return res.status(403).json({ message: 'Cannot delete the default admin account' });
                        }
                        await userToDelete.deleteOne();
                        return res.status(200).json({ message: 'User removed' });
                    }
                    return res.status(404).json({ message: 'User not found' });
                } catch (error) {
                    return res.status(500).json({ message: error.message });
                }

            default:
                return res.status(405).json({ message: 'Method not allowed' });
        }
    }

    // Handle all users route
    switch (method) {
        case 'GET':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }

                // Get all users (admin only)
                if (isAdmin) {
                    const users = await User.find({}).select('-password');
                    return res.status(200).json(users);
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

                // Update current user profile
                const { name, email, password } = body;

                const userToUpdate = await User.findById(user._id);

                if (!userToUpdate) {
                    return res.status(404).json({ message: 'User not found' });
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

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
