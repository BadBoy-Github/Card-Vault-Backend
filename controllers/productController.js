const Product = require('../models/Product');

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
