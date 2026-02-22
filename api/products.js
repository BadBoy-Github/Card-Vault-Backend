const connectDB = require('../_lib/db');
const Product = require('../models/Product');
const { protect, admin } = require('../middleware/authMiddleware');
const jwt = require('jsonwebtoken');

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

// @desc    Get all products
// @route   GET /api/products
// @access  Public
export default async function handler(req, res) {
    await connectDB();

    const { method, query, body } = req;
    const tokenUser = getUserFromToken(req);

    switch (method) {
        case 'GET':
            try {
                // Get single product by ID or all products
                if (query.id) {
                    const product = await Product.findOne({ id: query.id });
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
                const User = require('../models/User');
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
                const User = require('../models/User');
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const product = await Product.findOne({ id: query.id });
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
                    product.stock = body.stock || product.stock;
                    product.popular = body.popular || product.popular;
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
                const User = require('../models/User');
                const user = await User.findById(tokenUser.id);
                if (!user || user.role !== 'admin') {
                    return res.status(401).json({ message: 'Not authorized as admin' });
                }

                const result = await Product.deleteOne({ id: query.id });
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
}
