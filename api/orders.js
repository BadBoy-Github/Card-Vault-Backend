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

    // For admin routes, check if user is admin
    const isAdmin = user && user.role === 'admin';

    switch (method) {
        case 'GET':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }

                // Get user's orders
                if (query.myorders) {
                    const orders = await Order.find({ user: user._id });
                    return res.status(200).json(orders);
                }

                // Get single order
                if (query.id) {
                    const order = await Order.findById(query.id).populate('user', 'name email');
                    if (order) {
                        // Check if user owns order or is admin
                        if (order.user._id.toString() !== user._id.toString() && !isAdmin) {
                            return res.status(403).json({ message: 'Not authorized' });
                        }
                        return res.status(200).json(order);
                    } else {
                        return res.status(404).json({ message: 'Order not found' });
                    }
                }

                // Get all orders (admin only)
                if (isAdmin) {
                    const orders = await Order.find({}).populate('user', 'id name');
                    return res.status(200).json(orders);
                }

                return res.status(400).json({ message: 'Invalid request' });
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

        case 'PUT':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }

                if (!isAdmin) {
                    return res.status(403).json({ message: 'Not authorized as admin' });
                }

                const order = await Order.findById(query.id);

                if (order) {
                    // Update order status
                    if (body.status) {
                        order.status = body.status;
                    }

                    // Update order items if provided
                    if (body.orderItems) {
                        // Handle stock adjustments
                        const oldOrderItems = [...order.orderItems];
                        order.orderItems = body.orderItems;

                        for (const newItem of body.orderItems) {
                            const oldItem = oldOrderItems.find(i => {
                                const oldProductId = i.product instanceof Object ? i.product.toString() : i.product;
                                const newProductId = typeof newItem.product === 'string' ? newItem.product : newItem.product.toString();
                                return oldProductId === newProductId;
                            });

                            if (oldItem) {
                                const diff = newItem.qty - oldItem.qty;
                                if (diff !== 0) {
                                    const product = await Product.findById(newItem.product);
                                    if (product) {
                                        if (diff < 0) {
                                            product.stock += Math.abs(diff);
                                        } else {
                                            if (product.stock < diff) {
                                                return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
                                            }
                                            product.stock -= diff;
                                        }
                                        await product.save();
                                    }
                                }
                            } else {
                                const product = await Product.findById(newItem.product);
                                if (product) {
                                    if (product.stock < newItem.qty) {
                                        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
                                    }
                                    product.stock -= newItem.qty;
                                    await product.save();
                                }
                            }
                        }
                    }

                    order.totalPrice = body.totalPrice || order.totalPrice;
                    order.status = body.status || order.status;

                    const updatedOrder = await order.save();
                    return res.status(200).json(updatedOrder);
                } else {
                    return res.status(404).json({ message: 'Order not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                if (!user) {
                    return res.status(401).json({ message: 'Not authorized' });
                }

                if (!isAdmin) {
                    return res.status(403).json({ message: 'Not authorized as admin' });
                }

                const order = await Order.findById(query.id);

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
                } else {
                    return res.status(404).json({ message: 'Order not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
}
