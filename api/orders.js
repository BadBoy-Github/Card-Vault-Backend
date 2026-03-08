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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
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

    // /api/orders/123/send-giftcard or /orders/123/send-giftcard
    if (parts.length >= 4 && parts[parts.length - 1] === 'send-giftcard') {
        return { action: 'send-giftcard', id: parts[parts.length - 2] };
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

    // Handle send-giftcard route - Admin sends gift card to user
    if (action === 'send-giftcard') {
        if (!user || !isAdmin) {
            return res.status(403).json({ message: 'Not authorized as admin' });
        }
        if (method === 'POST') {
            try {
                const { cardNumber, pin, expiryDate } = body;

                if (!cardNumber || !pin || !expiryDate) {
                    return res.status(400).json({ message: 'Card number, PIN, and expiry date are required' });
                }

                const order = await Order.findById(id).populate('user', 'name email');

                if (!order) {
                    return res.status(404).json({ message: 'Order not found' });
                }

                // Verify order is eligible for gift card sending
                if (order.paymentStatus !== 'verified') {
                    return res.status(400).json({ message: 'Payment not verified for this order' });
                }

                if (order.status !== 'processing') {
                    return res.status(400).json({ message: 'Order must be in processing status to send gift card' });
                }

                // Get product name from order
                const productName = order.orderItems[0]?.name || 'Gift Card';

                // Send email using nodemailer
                const nodemailer = require('nodemailer');
                const transporter = nodemailer.createTransport({
                    host: process.env.SMTP_HOST || 'smtp.gmail.com',
                    port: process.env.SMTP_PORT || 587,
                    secure: false,
                    auth: {
                        user: process.env.SMTP_USER,
                        pass: process.env.SMTP_PASS,
                    },
                });

                const maskedCard = cardNumber.substring(0, 4) + ' ' + cardNumber.substring(4, 8) + ' ' + cardNumber.substring(8, 12) + ' ' + cardNumber.substring(12, 16);

                const mailOptions = {
                    from: "Card Vault <noreply@cardvault.in>",
                    to: order.user.email,
                    subject: `🎁 Your Gift Card is Here! - ${productName}`,
                    html: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#0f0f0f;">
    
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0f0f0f; padding:40px 10px;">
        <tr>
            <td align="center">
                <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background:#1a1a1a; border-radius:16px; overflow:hidden; border:1px solid #333;">
                    
                    <!-- Header with gradient -->
                    <tr>
                        <td style="background:linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding:35px 30px; text-align:center;">
                            <div style="font-size:11px; letter-spacing:3px; color:rgba(255,255,255,0.8); margin-bottom:8px;">CARD VAULT</div>
                            <h1 style="margin:0; font-size:28px; font-weight:600; color:#ffffff; letter-spacing:-0.5px;">Your Gift Card</h1>
                            <p style="margin:10px 0 0 0; font-size:14px; color:rgba(255,255,255,0.85);">Premium Digital Gift Card</p>
                        </td>
                    </tr>
                    
                    <!-- Main Content -->
                    <tr>
                        <td style="padding:35px 30px;">
                            <p style="margin:0 0 25px 0; font-size:15px; color:#e0e0e0; line-height:1.6;">
                                Dear <strong style="color:#ffffff;">${order.user.name}</strong>,
                            </p>
                            
                            <p style="margin:0 0 25px 0; font-size:15px; color:#e0e0e0; line-height:1.6;">
                                Thank you for your purchase! Your digital gift card is ready. Please find your card details below.
                            </p>
                            
                            <!-- Product Name Box -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#252525; border-radius:12px; margin-bottom:25px;">
                                <tr>
                                    <td style="padding:20px; text-align:center;">
                                        <div style="font-size:12px; letter-spacing:1px; color:#888; margin-bottom:6px;">PRODUCT</div>
                                        <div style="font-size:20px; font-weight:600; color:#ffffff;">${productName}</div>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Card Details -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#1e1e1e; border-radius:12px; border:1px solid #333;">
                                <tr>
                                    <td style="padding:25px;">
                                        <div style="font-size:11px; letter-spacing:1px; color:#666; margin-bottom:8px;">CARD NUMBER</div>
                                        <div style="font-size:22px; font-weight:600; color:#00d4aa; letter-spacing:3px; font-family:'Courier New', monospace;">
                                            ${maskedCard}
                                        </div>
                                        
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:20px;">
                                            <tr>
                                                <td width="50%">
                                                    <div style="font-size:11px; letter-spacing:1px; color:#666; margin-bottom:4px;">PIN</div>
                                                    <div style="font-size:18px; font-weight:600; color:#ffffff; letter-spacing:2px;">${pin}</div>
                                                </td>
                                                <td width="50%" style="text-align:right;">
                                                    <div style="font-size:11px; letter-spacing:1px; color:#666; margin-bottom:4px;">EXPIRY DATE</div>
                                                    <div style="font-size:18px; font-weight:600; color:#888; letter-spacing:1px;">${expiryDate}</div>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Instructions -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#252525; border-radius:12px; margin-top:25px;">
                                <tr>
                                    <td style="padding:20px;">
                                        <div style="font-size:12px; letter-spacing:1px; color:#888; margin-bottom:12px; font-weight:600;">HOW TO REDEEM</div>
                                        <ul style="margin:0; padding-left:18px; color:#aaa; font-size:13px; line-height:1.8;">
                                            <li>Visit the Card Vault website</li>
                                            <li>Enter your gift card details during checkout</li>
                                            <li>The card value will be applied to your order</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Important Notice -->
                            <div style="margin-top:25px; padding:15px; background:#2a2a2a; border-radius:8px; border-left:3px solid #f59e0b;">
                                <div style="font-size:12px; color:#f59e0b; font-weight:600; margin-bottom:5px;">⚠️ Important</div>
                                <div style="font-size:12px; color:#888; line-height:1.5;">
                                    Please keep your card details secure. Do not share your PIN with anyone. This card is non-refundable and non-transferable.
                                </div>
                            </div>
                            
                            <!-- Order ID -->
                            <div style="margin-top:25px; text-align:center;">
                                <span style="font-size:11px; color:#555;">Order ID: ${order._id}</span>
                            </div>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background:#141414; padding:25px 30px; text-align:center; border-top:1px solid #2a2a2a;">
                            <div style="font-size:16px; font-weight:600; color:#ffffff; margin-bottom:8px;">Card Vault</div>
                            <div style="font-size:12px; color:#666; line-height:1.6;">
                                Your Trusted Destination for Premium Gift Cards<br>
                                <a href="https://cardvault.in" style="color:#667eea; text-decoration:none;">cardvault.in</a>
                            </div>
                            <div style="margin-top:15px; font-size:11px; color:#444;">
                                © ${new Date().getFullYear()} Card Vault. All rights reserved.
                            </div>
                        </td>
                    </tr>
                    
                </table>
                
                <!-- Bottom spacing -->
                <div style="height:40px;"></div>
                
            </td>
        </tr>
    </table>
    
</body>
</html>
                    `,
                };

                await transporter.sendMail(mailOptions);

                // Update order with gift card details and set to delivered
                order.status = 'delivered';
                order.giftCardSentAt = new Date();
                order.giftCardNumber = cardNumber;
                order.giftCardPin = pin;
                order.giftCardExpiryDate = expiryDate;
                await order.save();

                return res.status(200).json({ message: 'Gift card sent successfully' });
            } catch (error) {
                console.error('Gift card send error:', error);
                return res.status(500).json({ message: 'Failed to send gift card', error: error.message });
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
