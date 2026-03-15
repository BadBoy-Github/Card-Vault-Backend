oconst Product = require('../models/Product');
const Newsletter = require('../api/_models/Newsletter');

// Generate a 9-character alphanumeric ID with uppercase, lowercase, and numbers
const generateProductId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 9; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
};

// Generate unique product ID by checking database
const generateUniqueProductId = async () => {
    let id;
    let exists = true;
    let attempts = 0;
    const maxAttempts = 100; // Safety limit

    while (exists && attempts < maxAttempts) {
        id = generateProductId();
        const existingProduct = await Product.findOne({ id });
        exists = !!existingProduct;
        attempts++;
    }

    if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique product ID after maximum attempts');
    }

    return id;
};

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        // Check if this is a request for a new product ID preview
        if (req.query.generateId === 'true') {
            const newId = await generateUniqueProductId();
            return res.json({ id: newId });
        }

        // Check if pagination is requested
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;

        // If page and limit are provided, return paginated response
        if (req.query.page || req.query.limit) {
            const skip = (page - 1) * limit;

            // Build search query
            const searchQuery = req.query.search || '';
            let query = {};

            // If search query exists, search in name, brand, description, category
            if (searchQuery) {
                query = {
                    $or: [
                        { name: { $regex: searchQuery, $options: 'i' } },
                        { brand: { $regex: searchQuery, $options: 'i' } },
                        { description: { $regex: searchQuery, $options: 'i' } },
                        { category: { $regex: searchQuery, $options: 'i' } },
                    ]
                };
            }

            // Get total count for pagination
            const total = await Product.countDocuments(query);

            // Get products with pagination
            const products = await Product.find(query)
                .skip(skip)
                .limit(limit)
                .sort({ createdAt: -1 });

            return res.json({
                products,
                total,
                page,
                pages: Math.ceil(total / limit),
            });
        }

        // Default: return all products without pagination
        const products = await Product.find({});
        res.json(products);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProductById = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });

        if (product) {
            res.json(product);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
    try {
        const {
            brand,
            name,
            denomination,
            category,
            image,
            description,
            price,
            validityEndDateTime,
            stock,
            popular,
        } = req.body;

        // Generate unique product ID
        const productId = await generateUniqueProductId();

        const product = new Product({
            id: productId,
            brand,
            name,
            denomination,
            value: price, // Use price as value
            category,
            image,
            description,
            price,
            validityEndDateTime,
            stock,
            popular,
        });

        const createdProduct = await product.save();

        // Send newsletter emails to all subscribers
        try {
            const subscribers = await Newsletter.find({ isActive: true });

            if (subscribers.length > 0) {
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

                const productName = createdProduct.name;
                const productBrand = createdProduct.brand;
                const productPrice = createdProduct.price;
                const productCategory = createdProduct.category;
                const productImage = createdProduct.image;
                const productId = createdProduct.id;

                // Send bulk emails to subscribers
                for (const subscriber of subscribers) {
                    // Check if subscriber's liked categories match the product category
                    const likedCategories = subscriber.likedCategories || [];
                    const shouldNotify = likedCategories.length === 0 ||
                        likedCategories.some(cat => productCategory?.toLowerCase().includes(cat.toLowerCase()));

                    if (!shouldNotify) continue;

                    const mailOptions = {
                        from: "Card Vault",
                        to: subscriber.email,
                        subject: `🎉 New ${productBrand} Gift Card Added!`,
                        html: `
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>

<body style="margin:0; padding:0; font-family:'Segoe UI', Arial, sans-serif; background:#f5f5f5;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5; padding:40px 10px;">
<tr>
<td align="center">

<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px; background:#ffffff; border-radius:12px; overflow:hidden; border:1px solid #e6e6e6;">

<!-- HEADER -->

<tr>
<td style="padding:30px; text-align:center; border-bottom:1px solid #eeeeee;">

<div style="font-size:12px; letter-spacing:3px; color:#888;">
CARD VAULT
</div>

<h1 style="margin:10px 0 5px 0; font-size:24px; font-weight:600; color:#222;">
New Gift Card Added!
</h1>

<p style="margin:0; font-size:14px; color:#777;">
Visit before it vanishes!
</p>

</td>
</tr>


<!-- PRODUCT DETAILS -->

<tr>
<td style="padding:30px;">

<p style="margin:0 0 20px 0; font-size:15px; color:#333; line-height:1.6;">
Dear <strong>${subscriber.name}</strong>,
</p>

<p style="margin:0 0 25px 0; font-size:15px; color:#555; line-height:1.6;">
A new gift card has been added to our collection. Don't miss out!
</p>


<!-- Product Box -->

<table width="100%" cellpadding="0" cellspacing="0" style="background:#fafafa; border:1px solid #eeeeee; border-radius:8px; margin-bottom:24px;">
<tr>
<td style="padding:18px; text-align:center;">
${productImage ? `<img src="${productImage}" alt="${productName}" style="max-width:200px; max-height:150px; border-radius:8px; margin-bottom:15px;" />` : ''}
<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:5px;">
PRODUCT
</div>
<div style="font-size:20px; font-weight:600; color:#222;">
${productName}
</div>
<div style="font-size:14px; color:#666; margin-top:5px;">
${productBrand}
</div>
</td>
</tr>
</table>


<!-- Card Details -->

<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eeeeee; border-radius:8px; background:#fafafa;">
<tr>
<td style="padding:20px;">

<div style="font-size:11px; letter-spacing:1px; color:#888; margin-bottom:4px;">
PRICE
</div>

<div style="font-size:18px; font-weight:600; color:#222;">
₹${productPrice}
</div>

</td>
</tr>
</table>


<!-- CTA BUTTON -->

<tr>
<td align="center" style="padding:30px 30px 0 30px;">

<a href="https://card-vaults.vercel.app/product/${productId}"

style="
display:inline-block;
padding:14px 30px;
background:#111;
color:#ffffff;
text-decoration:none;
border-radius:6px;
font-weight:600;
font-size:14px;
">

Shop Now

</a>

</td>
</tr>


<!-- FOOTER -->

<tr>
<td style="padding:22px 30px; border-top:1px solid #eeeeee; text-align:center; background:#fafafa;">

<div style="font-size:15px; font-weight:600; color:#222; margin-bottom:6px;">
Card Vault
</div>

<div style="font-size:12px; color:#777; line-height:1.6;">
Your Trusted Destination for Premium Gift Cards<br>
<a href="https://card-vaults.vercel.app/" style="color:#555; text-decoration:none;">
card-vaults.vercel.app
</a>
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

                    try {
                        await transporter.sendMail(mailOptions);
                    } catch (emailError) {
                        console.error('Failed to send newsletter to:', subscriber.email, emailError);
                    }
                }

                console.log(`Newsletter emails sent to ${subscribers.length} subscribers`);
            }
        } catch (newsletterError) {
            console.error('Newsletter email error:', newsletterError);
            // Don't fail the product creation if newsletter fails
        }

        res.status(201).json(createdProduct);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
    try {
        const product = await Product.findOne({ id: req.params.id });

        if (product) {
            product.brand = req.body.brand || product.brand;
            product.name = req.body.name || product.name;
            product.denomination = req.body.denomination || product.denomination;
            product.value = req.body.value || product.value;
            product.category = req.body.category || product.category;
            product.image = req.body.image || product.image;
            product.description = req.body.description || product.description;
            product.price = req.body.price || product.price;
            product.validityEndDateTime = req.body.validityEndDateTime || product.validityEndDateTime;
            product.stock = req.body.stock !== undefined ? req.body.stock : product.stock;
            product.popular = req.body.popular || product.popular;
            product.inStock = req.body.stock > 0;

            const updatedProduct = await product.save();
            res.json(updatedProduct);
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
    try {
        const result = await Product.deleteOne({ id: req.params.id });

        if (result.deletedCount > 0) {
            res.json({ message: 'Product removed' });
        } else {
            res.status(404).json({ message: 'Product not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
};
