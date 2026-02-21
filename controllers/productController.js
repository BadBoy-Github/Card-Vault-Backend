const Product = require('../models/Product');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
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
        } = req.body;

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
            product.stock = req.body.stock || product.stock;
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
