const connectDB = require('./_lib/db');
const FeaturedProduct = require('./_models/FeaturedProduct');
const jwt = require('jsonwebtoken');
const User = require('./_models/User');
const Newsletter = require('./_models/Newsletter');
const { sendNewsletterNewProduct } = require('./email');

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
        const existingProduct = await FeaturedProduct.findOne({ id });
        exists = !!existingProduct;
        attempts++;
    }

    if (attempts >= maxAttempts) {
        throw new Error('Unable to generate unique product ID after maximum attempts');
    }

    return id;
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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Max-Age': '86400',
    };
}

// Extract product ID from URL path
const getProductIdFromPath = (url) => {
    const path = url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    // Path is like /api/featured-products/123 or /featured-products/123
    if (parts.length >= 3 && parts[parts.length - 1] !== 'featured-products') {
        return parts[parts.length - 1];
    }
    return null;
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

    const { method, query, body } = req;
    const tokenUser = getUserFromToken(req);

    // Get product ID from path or query
    const productId = getProductIdFromPath(req.url) || query.id;

    // Check if this is a request for a new product ID preview
    if (method === 'GET' && query.generateId === 'true') {
        try {
            const newId = await generateUniqueProductId();
            return res.status(200).json({ id: newId });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    switch (method) {
        case 'GET':
            try {
                // Get single product by ID or all products
                if (productId) {
                    const product = await FeaturedProduct.findOne({ id: productId });
                    if (product) {
                        return res.status(200).json(product);
                    } else {
                        return res.status(404).json({ message: 'Featured Product not found' });
                    }
                } else {
                    // Check for search query
                    const searchQuery = query.search;
                    let products;

                    if (searchQuery) {
                        // Search by name, brand, or category
                        const searchRegex = new RegExp(searchQuery, 'i');
                        products = await FeaturedProduct.find({
                            $or: [
                                { name: searchRegex },
                                { brand: searchRegex },
                                { category: searchRegex },
                                { description: searchRegex }
                            ]
                        });
                    } else {
                        products = await FeaturedProduct.find({});
                    }

                    return res.status(200).json(products);
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'POST':
            try {
                // Check if admin
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const {
                    brand,
                    name,
                    subheading,
                    denomination,
                    category,
                    image,
                    description,
                    price,
                    validityEndDateTime,
                    stock,
                    popular,
                } = body;

                // Generate unique product ID
                const productId = await generateUniqueProductId();

                const product = new FeaturedProduct({
                    id: productId,
                    brand,
                    name,
                    subheading,
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

                // Send newsletter to all subscribers about the new featured product (async, don't wait)
                try {
                    const subscribers = await Newsletter.find({ isActive: true }).select('email name');
                    if (subscribers && subscribers.length > 0) {
                        // Send newsletter in background
                        sendNewsletterNewProduct(subscribers, {
                            name: createdProduct.name,
                            subheading: createdProduct.subheading,
                            brand: createdProduct.brand,
                            category: createdProduct.category,
                            price: createdProduct.price,
                            image: createdProduct.image,
                            description: createdProduct.description,
                            id: createdProduct.id
                        }).then(() => {
                            console.log(`Newsletter sent for new featured product: ${createdProduct.name}`);
                        }).catch(err => {
                            console.error('Failed to send newsletter:', err);
                        });
                    }
                } catch (newsletterError) {
                    console.error('Error sending newsletter:', newsletterError);
                    // Don't fail the product creation if newsletter fails
                }

                return res.status(201).json(createdProduct);
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'PUT':
            try {
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const product = await FeaturedProduct.findOne({ id: productId });
                if (product) {
                    product.brand = body.brand || product.brand;
                    product.name = body.name || product.name;
                    product.subheading = body.subheading || product.subheading;
                    product.denomination = body.denomination || product.denomination;
                    product.value = body.value || product.value;
                    product.category = body.category || product.category;
                    product.image = body.image || product.image;
                    product.description = body.description || product.description;
                    product.price = body.price || product.price;
                    product.validityEndDateTime = body.validityEndDateTime || product.validityEndDateTime;
                    product.stock = body.stock !== undefined ? body.stock : product.stock;
                    product.popular = body.popular !== undefined ? body.popular : product.popular;
                    product.inStock = body.stock > 0;

                    const updatedProduct = await product.save();
                    return res.status(200).json(updatedProduct);
                } else {
                    return res.status(404).json({ message: 'Featured Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        case 'DELETE':
            try {
                if (!tokenUser) {
                    return res.status(401).json({ message: 'Not authorized' });
                }
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const result = await FeaturedProduct.deleteOne({ id: productId });
                if (result.deletedCount > 0) {
                    return res.status(200).json({ message: 'Featured Product removed' });
                } else {
                    return res.status(404).json({ message: 'Featured Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
