const connectDB = require('./_lib/db');
const Newsletter = require('./_models/Newsletter');
const User = require('./_models/User');
const jwt = require('jsonwebtoken');

// CORS headers
function corsHeaders(req) {
    const origin = req.headers.origin || '*';
    return {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}

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
    const isAdmin = user && user.role === 'admin';

    // GET /api/newsletter - Get all newsletter subscribers (admin only)
    // GET /api/newsletter?email=xxx - Check subscription status for an email
    if (method === 'GET') {
        try {
            // Check if email query parameter is provided (for checking subscription status)
            const email = req.query.email;
            if (email) {
                const subscriber = await Newsletter.findOne({ email: email.toLowerCase().trim() });
                if (subscriber && subscriber.isActive) {
                    return res.status(200).json({ subscribed: true, subscriber });
                }
                return res.status(200).json({ subscribed: false });
            }

            // Admin only for getting all subscribers
            if (!isAdmin) {
                return res.status(403).json({ message: 'Not authorized as admin' });
            }
            const subscribers = await Newsletter.find({ isActive: true }).sort({ subscribedAt: -1 });
            return res.status(200).json(subscribers);
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    // POST /api/newsletter - Subscribe to newsletter
    if (method === 'POST') {
        try {
            const { name, email, age, phone, likedCategories } = body;

            if (!name || !email) {
                return res.status(400).json({ message: 'Name and email are required' });
            }

            // Check if already subscribed
            const existing = await Newsletter.findOne({ email: email.toLowerCase().trim() });
            if (existing) {
                if (!existing.isActive) {
                    // Reactivate the subscription
                    existing.isActive = true;
                    existing.name = name;
                    existing.age = age;
                    existing.phone = phone;
                    existing.likedCategories = likedCategories || [];
                    if (user) {
                        existing.user = user._id;
                    }
                    await existing.save();
                    return res.status(200).json({ message: 'Newsletter subscription reactivated', subscriber: existing });
                }
                return res.status(400).json({ message: 'Email already subscribed to newsletter' });
            }

            // Create new subscription
            const subscriber = new Newsletter({
                user: user ? user._id : null,
                name,
                email: email.toLowerCase().trim(),
                age,
                phone,
                likedCategories: likedCategories || [],
            });

            await subscriber.save();
            return res.status(201).json({ message: 'Successfully subscribed to newsletter', subscriber });
        } catch (error) {
            if (error.code === 11000) {
                return res.status(400).json({ message: 'Email already subscribed to newsletter' });
            }
            return res.status(500).json({ message: error.message });
        }
    }

    // PUT /api/newsletter - Unsubscribe from newsletter
    if (method === 'PUT') {
        try {
            const { email, action } = body;

            if (action === 'unsubscribe' && email) {
                const subscriber = await Newsletter.findOne({ email: email.toLowerCase().trim() });
                if (subscriber) {
                    subscriber.isActive = false;
                    await subscriber.save();
                    return res.status(200).json({ message: 'Unsubscribed from newsletter' });
                }
                return res.status(404).json({ message: 'Subscriber not found' });
            }

            return res.status(400).json({ message: 'Invalid action' });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    // DELETE /api/newsletter/:id - Delete subscriber (admin only)
    if (method === 'DELETE') {
        try {
            if (!isAdmin) {
                return res.status(403).json({ message: 'Not authorized as admin' });
            }

            const id = req.url.split('/').pop();
            const subscriber = await Newsletter.findByIdAndDelete(id);

            if (!subscriber) {
                return res.status(404).json({ message: 'Subscriber not found' });
            }

            return res.status(200).json({ message: 'Subscriber deleted' });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
};
