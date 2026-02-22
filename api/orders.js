const connectDB = require('./_lib/db');
const Order = require('./_models/Order');
const Product = require('./_models/Product');
const jwt = require('jsonwebtoken');
const User = require('./_models/User');

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

// Parse URL path to determine route
const parsePath = (url) => {
    const path = url.split('?')[0];
    const parts = path.split('/').filter(Boolean);

    // /api/orders/myorders or /orders/myorders
    if (parts.includes('myorders')) {
        return { action: 'myorders' };
    }

    // /api/orders/123/status or /orders/123/status
    if (parts.length >= 4 && parts[parts.length - 1] === 'status') {
        return { action: 'status', id: parts[parts.length - 2] };
    }

    // /api/orders/123 or /orders/123
    if (parts.length >= 3 && parts[parts.length - 1] !== 'orders') {
        return { action: 'single', id: parts[parts.length - 1] };
    }

    return { action: 'all' };
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
    const { action, id } = parsePath(req.url);

    // For admin routes, check if user is admin
    const isAdmin = user && user.role === 'admin';

    // Handle myorders route
    if (action === 'myorders') {
        if (!user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        if (method === 'GET') {
            try {
                const orders = await Order.find({ user: user._id }).sort({ createdAt: -1 });
                return res.status(200).json(orders);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Handle status update route
    if (action === 'status') {
        if (!user || !isAdmin) {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }
        if (method === 'PUT') {
            try {
                const { status } = body;
                const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
                if (order) {
                    return res.status(200).json(order);
                }
                return res.status(404).json({ message: 'Order not found' });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Handle single order route
    if (action === 'single') {
        if (!user) {
            return res.status(401).json({ message: 'Not authorized' });
        }

        switch (method) {
            case 'GET':
                try {
                    const order = await Order.findById(id).populate('user', 'name email');
                    if (order) {
                        // Check if user owns order or is admin
                        if (order.user._id.toString() !== user._id.toString() && !isAdmin) {
                            return res.status(403).json({ message: 'Not authorized' });
                        }
                        return res.status(200).json(order);
                    }
                    return res.status(404).json({ message: 'Order not found' });
                } catch (error) {
                    return res.status(500).json({ message: error.message });
                }

            case 'PUT':
                try {
                    if (!isAdmin) {
                        return res.status(403).json({ message: 'Not authorized as admin' });
                    }
                    const order = await Order.findByIdAndUpdate(id, body, { new: true });
                    if (order) {
                        return res.status(200).json(order);
                    }
                    return res.status(404).json({ message: 'Order not found' });
                } catch (error) {
                    return res.status(500).json({ message: error.message });
                }

            case 'DELETE':
                try {
                    if (!isAdmin) {
                        return res.status(403).json({ message: 'Not authorized as admin' });
                    }
                    const order = await Order.findById(id);
                    if (order) {
                        // Restore stock
                        for (const item of order.orderItems) {
                            const product = await Product.findById(item.product);
                            if (product) {
                                product.stock += item.qty;
                                await product.save();
                            }
                        }
                        await order.deleteOne();
                        return res.status(200).json({ message: 'Order removed' });
                    }
                    return res.status(404).json({ message: 'Order not found' });
                } catch (error) {
                    return res.status(500).json({ message: error.message });
                }

            default:
                return res.status(405).json({ message: 'Method not allowed' });
        }
    }

    // Handle all orders route
    switch (method) {
        case 'GET':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                // Get all orders (admin only)
                if (isAdmin) {
                    const orders = await Order.find({}).populate('user', 'id name').sort({ createdAt: -1 });
                    return res.status(200).json(orders);
                }
                return res.status(403).json({ message: 'Not authorized as admin' });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'POST':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }

                const { orderItems, totalPrice } = body;

                if (!orderItems || orderItems.length === 0) {
                    return res.status(400).json({ message: 'No order items' });
                }

                // Check stock and update
                for (const item of orderItems) {
                    const product = await Product.findById(item.product);
                    if (!product) {
                        return res.status(404).json({ message: `Product ${item.name} not found` });
                    }
                    if (product.stock < item.qty) {
                        return res.status(400).json({ message: `Insufficient stock for ${item.name}` });
                    }
                    product.stock -= item.qty;
                    await product.save();
                }

                const order = new Order({
                    orderItems,
                    user: user._id,
                    totalPrice,
                });

                const createdOrder = await order.save();
                return res.status(201).json(createdOrder);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
