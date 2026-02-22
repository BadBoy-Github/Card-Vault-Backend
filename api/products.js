const connectDB = require('./_lib/db');
const Product = require('./_models/Product');
const jwt = require('jsonwebtoken');
const User = require('./_models/User');

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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
    };
}

// Extract product ID from URL path
const getProductIdFromPath = (url) => {
    const path = url.split('?')[0];
    const parts = path.split('/').filter(Boolean);
    // Path is like /api/products/123 or /products/123
    if (parts.length >= 3 && parts[parts.length - 1] !== 'products') {
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

    switch (method) {
        case 'GET':
            try {
                // Get single product by ID or all products
                if (productId) {
                    const product = await Product.findOne({ id: productId });
                    if (product) {
                        return res.status(200).json(product);
                    } else {
                        return res.status(404).json({ message: 'Product not found' });
                    }
                } else {
                    const products = await Product.find({});
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
                    id,
                    brand,
                    name,
                    denomination,
                    value,
                    category,
                    image,
                    description,
                    price,
                    validityEndDateTime,
                    stock,
                    popular,
                } = body;

                const product = new Product({
                    id,
                    brand,
                    name,
                    denomination,
                    value,
                    category,
                    image,
                    description,
                    price,
                    validityEndDateTime,
                    stock,
                    popular,
                });

                const createdProduct = await product.save();
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

                const product = await Product.findOne({ id: productId });
                if (product) {
                    product.brand = body.brand || product.brand;
                    product.name = body.name || product.name;
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
                    return res.status(404).json({ message: 'Product not found' });
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

                const result = await Product.deleteOne({ id: productId });
                if (result.deletedCount > 0) {
                    return res.status(200).json({ message: 'Product removed' });
                } else {
                    return res.status(404).json({ message: 'Product not found' });
                }
            } catch (error) {
                return res.status(500).json({ message: error.message });
            }

        default:
            return res.status(405).json({ message: 'Method not allowed' });
    }
};
