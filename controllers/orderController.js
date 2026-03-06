const Order = require('../models/Order');

// @desc    Create new order
// @route   POST /api/orders
// @access  Private
const addOrderItems = async (req, res) => {
    const { orderItems, totalPrice, user: userId, createOnly } = req.body;
    const isAdmin = req.user.role === 'admin';

    if (orderItems && orderItems.length === 0) {
        return res.status(400).json({ message: 'No order items' });
    } else {
        try {
            const Product = require('../models/Product');

            // If createOnly is true, just check availability without reducing stock
            // This is used when creating order from payment page after UTR submission
            if (!createOnly) {
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
            }

            const order = new Order({
                orderItems,
                user: userId || req.user._id,
                totalPrice,
                paymentStatus: 'pending',
            });

            // For admin-created orders, reduce stock immediately
            // For user-created orders (createOnly=true), stock is reduced after UTR submission
            if (isAdmin) {
                for (const item of orderItems) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.stock -= item.qty;
                        await product.save();
                    }
                }
                order.paymentStatus = 'verified'; // Admin orders are considered paid
                order.status = 'delivered'; // Admin orders are delivered directly
                // Generate a placeholder UTR for admin orders
                order.utrNumber = 'ADMIN' + Date.now().toString().slice(-8);
            }

            const createdOrder = await order.save();
            res.status(201).json(createdOrder);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

// @desc    Get order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id).populate('user', 'name email');

        if (order) {
            res.json(order);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
    try {
        const orders = await Order.find({ user: req.user._id });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all orders
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
    try {
        const orders = await Order.find({}).populate('user', 'id name');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            order.status = req.body.status || order.status;
            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update order
// @route   PUT /api/orders/:id
// @access  Private/Admin
const updateOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            const Product = require('../models/Product');

            // Handle stock adjustments if quantity changed
            if (req.body.orderItems) {
                // Store old order items before updating
                const oldOrderItems = [...order.orderItems];

                // Update the order items
                order.orderItems = req.body.orderItems;

                // Then handle stock adjustments by comparing with old items
                for (const newItem of req.body.orderItems) {
                    const oldItem = oldOrderItems.find(i => {
                        const oldProductId = i.product instanceof require('mongoose').Types.ObjectId ? i.product.toString() : i.product;
                        const newProductId = typeof newItem.product === 'string' ? newItem.product : newItem.product.toString();
                        return oldProductId === newProductId;
                    });
                    if (oldItem) {
                        const diff = newItem.qty - oldItem.qty;
                        if (diff !== 0) {
                            const product = await Product.findById(newItem.product);
                            if (product) {
                                // If decreasing (diff < 0), we add stock back
                                // If increasing (diff > 0), we subtract stock
                                if (diff < 0) {
                                    // Adding back stock (decreasing quantity in order)
                                    product.stock += Math.abs(diff);
                                } else {
                                    // Checking if enough stock available
                                    if (product.stock < diff) {
                                        return res.status(400).json({ message: `Insufficient stock for ${product.name}` });
                                    }
                                    product.stock -= diff;
                                }
                                await product.save();
                            }
                        }
                    } else {
                        // New item being added to order - check and reduce stock
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

            order.totalPrice = req.body.totalPrice || order.totalPrice;
            order.status = req.body.status || order.status;
            order.user = req.body.user || order.user;

            const updatedOrder = await order.save();
            res.json(updatedOrder);
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete order
// @route   DELETE /api/orders/:id
// @access  Private/Admin
const deleteOrder = async (req, res) => {
    try {
        const order = await Order.findById(req.params.id);

        if (order) {
            const Product = require('../models/Product');

            // Restore stock only if payment was verified
            if (order.paymentStatus === 'verified') {
                for (const item of order.orderItems) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.stock += item.qty;
                        await product.save();
                    }
                }
            }

            await order.deleteOne();
            res.json({ message: 'Order removed' });
        } else {
            res.status(404).json({ message: 'Order not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Submit UTR for payment
// @route   POST /api/orders/:id/submit-utr
// @access  Private
const submitUTR = async (req, res) => {
    try {
        const { utrNumber, paymentAmount } = req.body;
        const order = await Order.findById(req.params.id);

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if user owns the order
        if (order.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        // Check if already submitted
        if (order.paymentStatus !== 'pending') {
            return res.status(400).json({ message: 'UTR already submitted for this order' });
        }

        // REDUCE STOCK NOW - Only after UTR is submitted
        const Product = require('../models/Product');
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

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Verify payment
// @route   PUT /api/orders/:id/verify-payment
// @access  Private/Admin
const verifyPayment = async (req, res) => {
    try {
        const { verified, paymentStatus } = req.body;
        const order = await Order.findById(req.params.id);

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
                // Restore stock if payment failed
                const Product = require('../models/Product');
                for (const item of order.orderItems) {
                    const product = await Product.findById(item.product);
                    if (product) {
                        product.stock += item.qty;
                        await product.save();
                    }
                }
            }
        } else if (verified) {
            order.paymentStatus = 'verified';
            order.status = 'processing';
            order.verifiedAt = new Date();
        } else {
            order.paymentStatus = 'failed';
            // Restore stock if payment failed
            const Product = require('../models/Product');
            for (const item of order.orderItems) {
                const product = await Product.findById(item.product);
                if (product) {
                    product.stock += item.qty;
                    await product.save();
                }
            }
        }

        const updatedOrder = await order.save();
        res.json(updatedOrder);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    addOrderItems,
    getOrderById,
    getMyOrders,
    getOrders,
    updateOrderStatus,
    updateOrder,
    deleteOrder,
    submitUTR,
    verifyPayment,
};
