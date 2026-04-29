const nodemailer = require('nodemailer');
const connectDB = require('./_lib/db');
const User = require('./_models/User');
const Wishlist = require('./_models/Wishlist');
const Product = require('./_models/Product');
const jwt = require('jsonwebtoken');

// Cart Schema (inline definition for reminders)
const mongoose = require('mongoose');
const cartItemSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, default: 1 }
});

const cartSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    products: [cartItemSchema],
    updatedAt: { type: Date, default: Date.now }
});

const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

// Create reusable transporter
const createTransporter = () => {
    return nodemailer.createTransporter({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });
};

// Send empty cart reminder email
const sendEmptyCartReminder = async (userEmail, userName) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: "Card Vault",
        to: userEmail,
        subject: `🛒 Your Cart is Feeling Lonely - Card Vault`,
        html: `
<div style="font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5; padding:30px 10px;">

  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e5e5e5;">

    <!-- Header -->
    <div style="padding:26px 28px; border-bottom:1px solid #e5e5e5; text-align:center;">
      <div style="font-size:12px; letter-spacing:2px; color:#777;">CARD VAULT</div>
      <h2 style="margin:8px 0 4px 0; font-weight:600; color:#222;">Your Cart Misses You! 🛒</h2>
      <div style="font-size:13px; color:#777;">It's been a while since you last shopped</div>
    </div>

    <!-- Content -->
    <div style="padding:28px; color:#333; font-size:15px; line-height:1.6;">

      <p style="margin-top:0;">
        Hey <strong>${userName}</strong>,
      </p>

      <p style="margin:0 0 20px 0;">
        We noticed your shopping cart has been sitting empty for a bit. It's probably wondering where all the fun gift cards went! 🎁
      </p>

      <p style="margin:0 0 20px 0;">
        Don't keep your cart waiting – it gets lonely without some amazing deals! Why not browse our latest collection and surprise yourself (or someone special) with a fantastic gift card?
      </p>

      <!-- CTA Button -->
      <div style="text-align:center; margin:30px 0;">
        <a href="https://card-vaults.vercel.app/search"
           style="display:inline-block; padding:14px 30px; background:#111; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:16px;">
          Start Shopping Now! 🛍️
        </a>
      </div>

      <p style="margin:20px 0 0 0; font-size:14px; color:#777;">
        Remember, great gift cards make great surprises! 🎉
      </p>

    </div>

    <!-- Footer -->
    <div style="padding:18px; border-top:1px solid #e5e5e5; text-align:center; font-size:12px; color:#777;">
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
    </div>

  </div>

</div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

// Send wishlist reminder email
const sendWishlistReminder = async (userEmail, userName, availableItems) => {
    const transporter = createTransporter();

    const itemsList = availableItems.map(item => `
      <div style="background:#fafafa; border:1px solid #e5e5e5; border-radius:8px; padding:16px; margin-bottom:12px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="80" valign="top">
              ${item.image ? `<img src="${item.image}" alt="${item.name}" style="width:60px; height:60px; object-fit:cover; border-radius:6px;">` : '<div style="width:60px; height:60px; background:#eee; border-radius:6px; display:flex; align-items:center; justify-content:center; font-size:24px;">🎁</div>'}
            </td>
            <td valign="top" style="padding-left:16px;">
              <div style="font-weight:600; color:#222; margin-bottom:4px;">${item.name}</div>
              <div style="color:#666; font-size:14px; margin-bottom:4px;">${item.brand}</div>
              <div style="color:#000; font-weight:600; font-size:16px;">₹${item.price}</div>
            </td>
          </tr>
        </table>
      </div>
    `).join('');

    const mailOptions = {
        from: "Card Vault",
        to: userEmail,
        subject: `💝 Your Wishlist is Waving Hello - Card Vault`,
        html: `
<div style="font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5; padding:30px 10px;">

  <div style="max-width:600px; margin:auto; background:#ffffff; border-radius:10px; overflow:hidden; border:1px solid #e5e5e5;">

    <!-- Header -->
    <div style="padding:26px 28px; border-bottom:1px solid #e5e5e5; text-align:center;">
      <div style="font-size:12px; letter-spacing:2px; color:#777;">CARD VAULT</div>
      <h2 style="margin:8px 0 4px 0; font-weight:600; color:#222;">Your Wishlist is Excited! 💝</h2>
      <div style="font-size:13px; color:#777;">Some items are ready and waiting for you</div>
    </div>

    <!-- Content -->
    <div style="padding:28px; color:#333; font-size:15px; line-height:1.6;">

      <p style="margin-top:0;">
        Hey <strong>${userName}</strong>,
      </p>

      <p style="margin:0 0 20px 0;">
        Your wishlist items have been patiently waiting for their moment in the spotlight! 🌟 We've checked and found ${availableItems.length} item${availableItems.length > 1 ? 's' : ''} that are still available and haven't expired yet.
      </p>

      <p style="margin:0 0 25px 0;">
        Don't keep them waiting any longer – they might start planning their own shopping trip! 🛍️
      </p>

      <!-- Wishlist Items -->
      <div style="margin-bottom:25px;">
        <div style="font-size:14px; font-weight:600; color:#555; margin-bottom:12px;">
          Available Items:
        </div>
        ${itemsList}
      </div>

      <!-- CTA Button -->
      <div style="text-align:center; margin:30px 0;">
        <a href="https://card-vaults.vercel.app/wishlist"
           style="display:inline-block; padding:14px 30px; background:#111; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:16px;">
          Check Your Wishlist 🛒
        </a>
      </div>

      <p style="margin:20px 0 0 0; font-size:14px; color:#777;">
        Life's too short for expired wishes – treat yourself today! 🎁
      </p>

    </div>

    <!-- Footer -->
    <div style="padding:18px; border-top:1px solid #e5e5e5; text-align:center; font-size:12px; color:#777;">
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
    </div>

  </div>

</div>
        `,
    };

    await transporter.sendMail(mailOptions);
};

// Helper to check if product is available (not expired and in stock)
const isProductAvailable = (product) => {
    // Check if not expired
    if (product.validityEndDateTime) {
        const expiryDate = new Date(product.validityEndDateTime);
        if (expiryDate < new Date()) {
            return false; // Expired
        }
    }

    // Check stock availability
    if (product.stock === false || product.stock === 0) {
        return false; // Out of stock
    }

    return true;
};

module.exports = async function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST' && req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        await connectDB();

        let emptyCartCount = 0;
        let wishlistReminderCount = 0;

        // 1. Send empty cart reminders
        const emptyCarts = await Cart.find({
            products: { $size: 0 } // Empty cart
        }).populate('user');

        for (const cart of emptyCarts) {
            if (cart.user && cart.user.email) {
                try {
                    await sendEmptyCartReminder(cart.user.email, cart.user.name || 'Valued Customer');
                    emptyCartCount++;
                } catch (emailError) {
                    console.error('Failed to send empty cart reminder:', emailError);
                }
            }
        }

        // 2. Send wishlist reminders
        const wishlists = await Wishlist.find({})
            .populate('user')
            .populate('products.product');

        for (const wishlist of wishlists) {
            if (!wishlist.user || !wishlist.user.email) continue;

            const availableItems = [];

            for (const item of wishlist.products) {
                if (item.product && isProductAvailable(item.product)) {
                    availableItems.push(item.product);
                }
            }

            if (availableItems.length > 0) {
                try {
                    await sendWishlistReminder(
                        wishlist.user.email,
                        wishlist.user.name || 'Valued Customer',
                        availableItems
                    );
                    wishlistReminderCount++;
                } catch (emailError) {
                    console.error('Failed to send wishlist reminder:', emailError);
                }
            }
        }

        return res.status(200).json({
            message: 'Reminder emails sent successfully',
            emptyCartReminders: emptyCartCount,
            wishlistReminders: wishlistReminderCount
        });

    } catch (error) {
        console.error('Reminder error:', error);
        return res.status(500).json({ message: 'Failed to send reminders', error: error.message });
    }
};