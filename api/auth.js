const connectDB = require('./_lib/db');
const jwt = require('jsonwebtoken');
const User = require('./_models/User');
const bcrypt = require('bcryptjs');

// Generate JWT
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

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

    const { method, body } = req;
    const tokenUser = getUserFromToken(req);

    // Get the path to determine the action
    const path = req.url.split('?')[0];
    const isLogin = path.endsWith('/login');
    const isRegister = path.endsWith('/register');
    const isCheckEmail = path.endsWith('/check-email');
    const isResetPassword = path.endsWith('/reset-password');

    switch (method) {
        case 'POST':
            try {
                const { name, email, password } = body;

                // Check if email exists
                if (isCheckEmail) {
                    const { email } = body;
                    if (!email) {
                        return res.status(400).json({ message: 'Email is required' });
                    }
                    const userExists = await User.findOne({ email });
                    return res.status(200).json({ exists: !!userExists });
                }

                // Reset password
                if (isResetPassword) {
                    const { email, newPassword } = body;
                    if (!email || !newPassword) {
                        return res.status(400).json({ message: 'Email and new password are required' });
                    }
                    const user = await User.findOne({ email });
                    if (!user) {
                        return res.status(404).json({ message: 'User not found' });
                    }
                    user.password = newPassword;
                    await user.save();
                    return res.status(200).json({ message: 'Password updated successfully' });
                }

                // Register
                if (isRegister) {
                    const userExists = await User.findOne({ email });

                    if (userExists) {
                        return res.status(400).json({ message: 'User already exists' });
                    }

                    const user = await User.create({
                        name,
                        email,
                        password,
                    });

                    if (user) {
                        return res.status(201).json({
                            _id: user._id,
                            name: user.name,
                            email: user.email,
                            role: user.role,
                            token: generateToken(user._id),
                        });
                    } else {
                        return res.status(400).json({ message: 'Invalid user data' });
                    }
                }

                // Login
                const user = await User.findOne({ email }).select('+password');

                if (user && (await user.matchPassword(password))) {
                    return res.status(200).json({
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                        token: generateToken(user._id),
                    });
                } else {
                    return res.status(401).json({ message: 'Invalid email or password' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'GET':
            try {
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized, no token' });
                }

                const user = await User.findById(tokenUser.id);
                if (user) {
                    return res.status(200).json({
                        _id: user._id,
                        name: user.name,
                        email: user.email,
                        role: user.role,
                    });
                } else {
                    return res.status(404).json({ message: 'User not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
