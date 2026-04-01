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

    // /api/payment/config or /payment/config
    if (parts.includes('payment') && parts.includes('config')) {
        return { action: 'payment-config' };
    }

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

    const { method, body, query } = req;
    const user = await getUserFromToken(req);
    const { action, id } = parsePath(req.url);

    // Determine order type (regular or featured)
    const orderType = query.type === 'featured' ? 'featured' : 'regular';

    // For admin routes, check if user is admin
    const isAdmin = user && user.role === 'admin';

    // Handle payment config route
    if (action === 'payment-config') {
        if (method === 'GET') {
            try {
                const upiId = process.env.UPI_ID || '';
                const merchantName = process.env.UPI_MERCHANT_NAME || 'CardVault';
                const qrImageUrl = process.env.UPI_QR_IMAGE_URL || '';

                return res.status(200).json({
                    upiId: upiId,
                    merchantName: merchantName,
                    qrImageUrl: qrImageUrl,
                    paymentInstructions: [
                        'Scan the QR code using any UPI app (GPay, PhonePe, Paytm)',
                        'Enter the exact amount shown',
                        'After payment, enter the UTR/Transaction ID',
                        'Wait for payment verification'
                    ]
                });
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }
        }
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Handle myorders route
    if (action === 'myorders') {
        if (!user) {
            return res.status(401).json({ message: 'Not authorized' });
        }
        if (method === 'GET') {
            try {
                // Filter by order type
                const filter = { user: user._id, type: orderType };
                const orders = await Order.find(filter).sort({ createdAt: -1 });
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
                    // Handle both regular and featured products
                    if (order.type === 'featured' && item.featuredProduct) {
                        const product = await Product.findById(item.featuredProduct);
                        if (product) {
                            product.stock -= item.qty;
                            await product.save();
                        }
                    } else if (item.product) {
                        const product = await Product.findById(item.product);
                        if (product) {
                            product.stock -= item.qty;
                            await product.save();
                        }
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
                const { cardNumber, pin, expiryDate, giftCardCode } = body;

                const order = await Order.findById(id).populate('user', 'name email');

                if (!order) {
                    return res.status(404).json({ message: 'Order not found' });
                }

                // Verify order is eligible for gift card sending
                if (!order.user) {
                    return res.status(400).json({ message: 'Order has no associated user' });
                }
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

                const customerName = order.user?.name || 'Customer';
                const orderId = order._id;

                let mailOptions;
                let finalGiftCardCode;
                let finalExpiryDate = expiryDate;

                if (order.type === 'featured') {
                    // Featured order - use single giftCardCode
                    if (!giftCardCode || !expiryDate) {
                        return res.status(400).json({ message: 'Gift card code and expiry date are required' });
                    }
                    if (giftCardCode.length < 2) {
                        return res.status(400).json({ message: 'Gift card code must be at least 2 characters' });
                    }
                    finalGiftCardCode = giftCardCode;

                    mailOptions = {
                        from: process.env.EMAIL_FROM || process.env.SMTP_USER || "Card Vault",
                        to: order.user.email,
                        subject: `🎁 Your Featured Gift Card Code is Here! - ${productName}`,
                        html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5;">

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5; padding:40px 10px;">
<tr>
<td align="center">

<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e6e6e6;">

<!-- Header -->

<tr>
<td style="padding:30px 30px 24px 30px; text-align:center; border-bottom:1px solid #eeeeee;">
<div style="font-size:12px; letter-spacing:3px; color:#888;">CARD VAULT</div>
<h1 style="margin:10px 0 5px 0; font-size:26px; font-weight:600; color:#222;">
Your Gift Card Code
</h1>
<p style="margin:0; font-size:14px; color:#777;">
Featured Gift Card
</p>
</td>
</tr>


<!-- Main Content -->

<tr>
<td style="padding:30px;">

<p style="margin:0 0 20px 0; font-size:15px; color:#333; line-height:1.6;">
Dear <strong>${customerName}</strong>,
</p>

<p style="margin:0 0 25px 0; font-size:15px; color:#555; line-height:1.6;">
Thank you for your purchase. Your featured gift card code is ready. 
Please find the code details below.
</p>


<!-- Product Box -->

<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; border:1px solid #eeeeee; border-radius:8px; margin-bottom:24px;">
<tr>
<td style="padding:18px; text-align:center;">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:5px;">
PRODUCT
</div>
<div style="font-size:20px; font-weight:600; color:#222;">
${productName}
</div>
</td>
</tr>
</table>


<!-- Card Code Details -->

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee; border-radius:8px; background:#fafafa;">
<tr>
<td style="padding:20px;">

<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:6px;">
GIFT CARD CODE
</div>

<div style="font-size:22px; font-weight:600; color:#222; letter-spacing:3px; font-family:'Courier New', monospace;">
${giftCardCode}
</div>


<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
<tr>

<td width="100%">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:4px;">
EXPIRY DATE
</div>

<div style="font-size:18px; font-weight:600; color:#666;">
${expiryDate}
</div>
</td>

</tr>
</table>

</td>
</tr>
</table>


<!-- Important Notice -->

<div style="margin-top:24px; padding:16px; background:#fafafa; border:1px solid #eeeeee; border-left:3px solid #cccccc; border-radius:6px;">
<div style="font-size:12px; font-weight:600; color:#444; margin-bottom:4px;">
Important
</div>

<div style="font-size:12px; color:#666; line-height:1.5;">
Please keep your code secure. Do not share your code with anyone.
This code is non-refundable and non-transferable.
</div>
</div>


<!-- Order ID -->

<div style="margin-top:25px; text-align:center;">
<span style="font-size:11px; color:#888;">
Order ID: ${orderId}
</span>
</div>

</td>
</tr>


<!-- Footer -->

<tr>
<td style="padding:22px 30px; border-top:1px solid #eeeeee; text-align:center; background:#fafafa;">

<div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">card-vaults.vercel.app</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>

</td>
</tr>


</table>

<div style="height:40px;"></div>

</td>
</tr>
</table>

</body>
</html>
                        `,
                    };
                } else {
                    // Regular order - use cardNumber + pin
                    if (!cardNumber || !pin || !expiryDate) {
                        return res.status(400).json({ message: 'Card number, PIN, and expiry date are required' });
                    }

                    // Validate card number length
                    const cleanCardNumber = cardNumber.replace(/\s/g, '');
                    if (cleanCardNumber.length < 16) {
                        return res.status(400).json({ message: 'Card number must be 16 digits' });
                    }

                    finalGiftCardCode = cardNumber;

                    const maskedCard = cardNumber.replace(/\s/g, '').substring(0, 4) + ' ' + cardNumber.replace(/\s/g, '').substring(4, 8) + ' ' + cardNumber.replace(/\s/g, '').substring(8, 12) + ' ' + cardNumber.replace(/\s/g, '').substring(12, 16);

                    mailOptions = {
                        from: process.env.EMAIL_FROM || process.env.SMTP_USER || "Card Vault",
                        to: order.user.email,
                        subject: `🎁 Your Gift Card is Here! - ${productName}`,
                        html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5;">

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f5f5; padding:40px 10px;">
<tr>
<td align="center">

<table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e6e6e6;">

<!-- Header -->

<tr>
<td style="padding:30px 30px 24px 30px; text-align:center; border-bottom:1px solid #eeeeee;">
<div style="font-size:12px; letter-spacing:3px; color:#888;">CARD VAULT</div>
<h1 style="margin:10px 0 5px 0; font-size:26px; font-weight:600; color:#222;">
Your Gift Card
</h1>
<p style="margin:0; font-size:14px; color:#777;">
Premium Digital Gift Card
</p>
</td>
</tr>


<!-- Main Content -->

<tr>
<td style="padding:30px;">

<p style="margin:0 0 20px 0; font-size:15px; color:#333; line-height:1.6;">
Dear <strong>${customerName}</strong>,
</p>

<p style="margin:0 0 25px 0; font-size:15px; color:#555; line-height:1.6;">
Thank you for your purchase. Your digital gift card is ready. 
Please find the card details below.
</p>


<!-- Product Box -->

<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; border:1px solid #eeeeee; border-radius:8px; margin-bottom:24px;">
<tr>
<td style="padding:18px; text-align:center;">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:5px;">
PRODUCT
</div>
<div style="font-size:20px; font-weight:600; color:#222;">
${productName}
</div>
</td>
</tr>
</table>


<!-- Card Details -->

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee; border-radius:8px; background:#fafafa;">
<tr>
<td style="padding:20px;">

<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:6px;">
CARD NUMBER
</div>

<div style="font-size:22px; font-weight:600; color:#222; letter-spacing:3px; font-family:'Courier New', monospace;">
${maskedCard}
</div>


<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;">
<tr>

<td width="50%">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:4px;">
PIN
</div>

<div style="font-size:18px; font-weight:600; color:#222; letter-spacing:2px;">
${pin}
</div>
</td>


<td width="50%" style="text-align:right;">
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:4px;">
EXPIRY DATE
</div>

<div style="font-size:18px; font-weight:600; color:#666;">
${expiryDate}
</div>
</td>

</tr>
</table>

</td>
</tr>
</table>


<!-- Important Notice -->

<div style="margin-top:24px; padding:16px; background:#fafafa; border:1px solid #eeeeee; border-left:3px solid #cccccc; border-radius:6px;">
<div style="font-size:12px; font-weight:600; color:#444; margin-bottom:4px;">
Important
</div>

<div style="font-size:12px; color:#666; line-height:1.5;">
Please keep your card details secure. Do not share your PIN with anyone.
This card is non-refundable and non-transferable.
</div>
</div>


<!-- Order ID -->

<div style="margin-top:25px; text-align:center;">
<span style="font-size:11px; color:#888;">
Order ID: ${orderId}
</span>
</div>

</td>
</tr>


<!-- Footer -->

<tr>
<td style="padding:22px 30px; border-top:1px solid #eeeeee; text-align:center; background:#fafafa;">

<div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">card-vaults.vercel.app</a>
</div>

<div style="margin-top:12px; font-size:11px; color:#999;">
© ${new Date().getFullYear()} Card Vault. All rights reserved.
</div>

</td>
</tr>


</table>

<div style="height:40px;"></div>

</td>
</tr>
</table>

</body>
</html>
                        `,
                    };
                }

                await transporter.sendMail(mailOptions);

                // Update order with gift card details and set to delivered
                order.status = 'delivered';
                order.giftCardSentAt = new Date();

                if (order.type === 'featured') {
                    order.giftCardCode = giftCardCode;
                } else {
                    order.giftCardNumber = cardNumber;
                    order.giftCardPin = pin;
                }
                order.giftCardExpiryDate = finalExpiryDate;

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
                        // Restore stock - handle both regular and featured products
                        for (const item of order.orderItems) {
                            if (order.type === 'featured' && item.featuredProduct) {
                                const product = await Product.findById(item.featuredProduct);
                                if (product) {
                                    product.stock += item.qty;
                                    await product.save();
                                }
                            } else if (item.product) {
                                const product = await Product.findById(item.product);
                                if (product) {
                                    product.stock += item.qty;
                                    await product.save();
                                }
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
                // Get all orders filtered by type (admin only)
                if (isAdmin) {
                    const filter = { type: orderType };
                    const orders = await Order.find(filter).populate('user', 'id name email').sort({ createdAt: -1 });
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

                const { orderItems, totalPrice, user: orderUser, utrNumber, paymentAmount, paymentStatus, paymentMethod, type } = body;

                if (!orderItems || orderItems.length === 0) {
                    return res.status(400).json({ message: 'No order items' });
                }

                // Determine order type from body or query
                const orderTypeFromBody = type || orderType;

                // Check stock availability - handle both regular and featured products
                for (const item of orderItems) {
                    if (orderTypeFromBody === 'featured' && item.featuredProduct) {
                        const product = await Product.findById(item.featuredProduct);
                        if (!product) {
                            return res.status(404).json({ message: `Featured Product ${item.name} not found` });
                        }
                        if (product.stock < item.qty) {
                            return res.status(400).json({ message: `Insufficient stock for ${item.name}` });
                        }
                    } else if (item.product) {
                        const product = await Product.findById(item.product);
                        if (!product) {
                            return res.status(404).json({ message: `Product ${item.name} not found` });
                        }
                        if (product.stock < item.qty) {
                            return res.status(400).json({ message: `Insufficient stock for ${item.name}` });
                        }
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
                        if (orderTypeFromBody === 'featured' && item.featuredProduct) {
                            const product = await Product.findById(item.featuredProduct);
                            if (product) {
                                product.stock -= item.qty;
                                await product.save();
                            }
                        } else if (item.product) {
                            const product = await Product.findById(item.product);
                            if (product) {
                                product.stock -= item.qty;
                                await product.save();
                            }
                        }
                    }
                }

                // Create order - use provided payment details or defaults
                const order = new Order({
                    orderItems,
                    user: orderUserId,
                    type: orderTypeFromBody,
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

                // Send email notification to admin about new order
                try {
                    // Fetch user details for the email
                    const orderUserData = await User.findById(orderUserId).select('name email');

                    // Prepare email data
                    const emailData = {
                        orderId: createdOrder._id.toString(),
                        customerName: orderUserData?.name || 'Customer',
                        customerEmail: orderUserData?.email || '',
                        productName: orderItems[0]?.name || 'Gift Card',
                        totalPrice: totalPrice,
                        orderItems: orderItems,
                        paymentStatus: createdOrder.paymentStatus,
                        orderDate: createdOrder.createdAt?.toLocaleString() || new Date().toLocaleString()
                    };

                    // Send email notification to admin
                    const emailRes = await fetch(`${process.env.API_URL || 'https://card-vault-backend.vercel.app'}/api/email`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            type: 'neworder',
                            data: emailData
                        })
                    });

                    if (!emailRes.ok) {
                        console.error('Failed to send order notification email');
                    }
                } catch (emailError) {
                    // Log error but don't fail the order if email fails
                    console.error('Order notification email error:', emailError);
                }

                // Send order confirmation email to customer
                try {
                    const orderUserData = await User.findById(orderUserId).select('name email');

                    if (orderUserData?.email) {
                        const { sendOrderConfirmation } = require('./email');

                        await sendOrderConfirmation(orderUserData.email, {
                            orderId: createdOrder._id.toString(),
                            customerName: orderUserData?.name || 'Customer',
                            productName: orderItems[0]?.name || 'Gift Card',
                            totalPrice: totalPrice,
                            orderItems: orderItems,
                            orderDate: createdOrder.createdAt?.toLocaleString() || new Date().toLocaleString()
                        });

                        console.log('Order confirmation email sent to:', orderUserData.email);
                    }
                } catch (customerEmailError) {
                    console.error('Customer order confirmation email error:', customerEmailError);
                }

                return res.status(201).json(createdOrder);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
