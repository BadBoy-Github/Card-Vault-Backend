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

    // /api/orders/123/submit-utr or /orders/123/submit-utr
    if (parts.length >= 4 && parts[parts.length - 1] === 'submit-utr') {
        return { action: 'submit-utr', id: parts[parts.length - 2] };
    }

    // /api/orders/123/verify-payment or /orders/123/verify-payment
    if (parts.length >= 4 && parts[parts.length - 1] === 'verify-payment') {
        return { action: 'verify-payment', id: parts[parts.length - 2] };
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

    // Handle submit-utr route - User submits UTR after payment
    if (action === 'submit-utr') {
        if (!user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        if (method === 'POST') {
            try {
                const { utrNumber, paymentAmount } = body;

                if (!utrNumber) {
                    return res.status(400).json({ message: 'UTR Number is required' });
                }

                const order = await Order.findById(id);

                if (!order) {
                    return res.status(404).json({ message: 'Order not found' });
                }

                // Check if user owns the order
                if (order.user.toString() !== user._id.toString()) {
                    return res.status(403).json({ message: 'Not authorized' });
                }

                // Check if already submitted
                if (order.paymentStatus !== 'pending') {
                    return res.status(400).json({ message: 'UTR already submitted for this order' });
                }

                // REDUCE STOCK NOW - Only after UTR is submitted
                for (const item of order.orderItems) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.stock -= item.qty;
                        await product.save();
                    }
                }

                // Update order with UTR details
                order.utrNumber = utrNumber;
                order.paymentAmount = paymentAmount || order.totalPrice;
                order.paymentStatus = 'awaiting_verification';
                order.paymentSubmittedAt = new Date();

                await order.save();
                return res.status(200).json(order);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Handle verify-payment route - Admin verifies payment
    if (action === 'verify-payment') {
        if (!user || !isAdmin) {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }
        if (method === 'PUT') {
            try {
                const { verified, notes, paymentStatus } = body;

                const order = await Order.findById(id);

                if (!order) {
                    return res.status(404).json({ message: 'Order not found' });
                }

                // If paymentStatus is explicitly provided, use it
                if (paymentStatus) {
                    order.paymentStatus = paymentStatus;
                    if (paymentStatus === 'verified') {
                        order.status = 'processing';
                        order.verifiedAt = new Date();
                    } else if (paymentStatus === 'failed') {
                        order.status = 'cancelled';
                    }
                } else if (verified) {
                    order.paymentStatus = 'verified';
                    order.status = 'processing'; // Auto-update order status to processing
                    order.verifiedAt = new Date();
                } else {
                    order.paymentStatus = 'failed';
                }

                await order.save();
                return res.status(200).json(order);
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
                    const orders = await Order.find({}).populate('user', 'id name email').sort({ createdAt: -1 });
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

                const { orderItems, totalPrice, user: orderUser, utrNumber, paymentAmount, paymentStatus, paymentMethod } = body;

                if (!orderItems || orderItems.length === 0) {
                    return res.status(400).json({ message: 'No order items' });
                }

                // Check stock availability
                for (const item of orderItems) {
                    const product = await Product.findById(item.product);
                    if (!product) {
                        return res.status(404).json({ message: `Product ${item.name} not found` });
                    }
                    if (product.stock < item.qty) {
                        return res.status(400).json({ message: `Insufficient stock for ${item.name}` });
                    }
                }

                // Determine the user for this order
                // Admin can create order for themselves or for another user
                // Regular users can only create orders for themselves
                let orderUserId = user._id;
                if (isAdmin && orderUser) {
                    // Admin creating order for another user
                    orderUserId = orderUser;
                } else if (!isAdmin) {
                    // Regular user - must be their own user ID
                    orderUserId = user._id;
                }

                // Determine payment status
                // If utrNumber is provided, payment is being submitted along with order
                const isUTRSubmitted = utrNumber && utrNumber.trim().length > 0;

                // If admin creates order directly (not from user checkout), set payment as verified
                // Admin manually creating order means payment is already received
                let finalPaymentStatus;
                if (isUTRSubmitted) {
                    finalPaymentStatus = paymentStatus || 'awaiting_verification';
                } else if (isAdmin) {
                    // Admin creating order directly - payment already received
                    finalPaymentStatus = 'verified';
                } else {
                    finalPaymentStatus = 'pending';
                }

                // If UTR is submitted, reduce stock immediately
                if (isUTRSubmitted) {
                    for (const item of orderItems) {
                        const product = await Product.findById(item.product);
                        if (product) {
                            product.stock -= item.qty;
                            await product.save();
                        }
                    }
                }

                // Create order - use provided payment details or defaults
                const order = new Order({
                    orderItems,
                    user: orderUserId,
                    totalPrice,
                    // Use determined payment status
                    paymentStatus: finalPaymentStatus,
                    status: body.status || (isUTRSubmitted ? 'processing' : 'processing'),
                    // Payment details - save if UTR is submitted
                    utrNumber: utrNumber || null,
                    paymentAmount: paymentAmount ? parseFloat(paymentAmount) : (totalPrice ? parseFloat(totalPrice) : null),
                    paymentMethod: paymentMethod || 'UPI',
                    paymentSubmittedAt: isUTRSubmitted ? new Date() : null,
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
