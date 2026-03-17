const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Get user cart
// @route   GET /api/cart
// @access  Private
const getCart = async (req, res) => {
    try {
        let cart = await Cart.findOne({ user: req.user._id }).populate('products.product');

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, products: [] });
        }

        // Filter out products that don't exist or have been deleted
        const validProducts = cart.products.filter(item => item.product !== null);

        // If there were invalid products, update the cart
        if (validProducts.length !== cart.products.length) {
            cart.products = validProducts;
            await cart.save();
        }

        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add product to cart
// @route   POST /api/cart/add
// @access  Private
const addToCart = async (req, res) => {
    const { productId, quantity = 1 } = req.body;

    try {
        // Check if product exists and is in stock
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (product.stock < 1) {
            return res.status(400).json({ message: 'Product is out of stock' });
        }

        let cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            cart = await Cart.create({ user: req.user._id, products: [] });
        }

        // Check if product already in cart
        const productIndex = cart.products.findIndex(
            p => p.product.toString() === productId
        );

        if (productIndex > -1) {
            // Update quantity
            const newQuantity = cart.products[productIndex].quantity + quantity;

            // Check stock availability
            if (newQuantity > product.stock) {
                return res.status(400).json({ message: `Only ${product.stock} items available in stock` });
            }

            cart.products[productIndex].quantity = newQuantity;
        } else {
            // Add new product to cart
            cart.products.push({ product: productId, quantity });
        }

        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate('products.product');
        res.json(updatedCart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Remove product from cart
// @route   DELETE /api/cart/remove/:productId
// @access  Private
const removeFromCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.products = cart.products.filter(
            p => p.product.toString() !== req.params.productId
        );

        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate('products.product');
        res.json(updatedCart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update product quantity in cart
// @route   PUT /api/cart/update/:productId
// @access  Private
const updateCartQuantity = async (req, res) => {
    const { quantity } = req.body;

    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const productIndex = cart.products.findIndex(
            p => p.product.toString() === req.params.productId
        );

        if (productIndex === -1) {
            return res.status(404).json({ message: 'Product not found in cart' });
        }

        // Check stock availability
        const product = await Product.findById(req.params.productId);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        if (quantity > product.stock) {
            return res.status(400).json({ message: `Only ${product.stock} items available in stock` });
        }

        if (quantity < 1) {
            // Remove product if quantity is less than 1
            cart.products.splice(productIndex, 1);
        } else {
            cart.products[productIndex].quantity = quantity;
        }

        await cart.save();

        const updatedCart = await Cart.findById(cart._id).populate('products.product');
        res.json(updatedCart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Clear cart
// @route   DELETE /api/cart/clear
// @access  Private
const clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        cart.products = [];
        await cart.save();

        res.json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Check if product is in cart
// @route   GET /api/cart/check/:productId
// @access  Private
const checkCart = async (req, res) => {
    try {
        const cart = await Cart.findOne({ user: req.user._id });

        if (!cart) {
            return res.json({ isInCart: false, quantity: 0 });
        }

        const cartItem = cart.products.find(
            p => p.product.toString() === req.params.productId
        );

        res.json({
            isInCart: !!cartItem,
            quantity: cartItem ? cartItem.quantity : 0
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getCart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    checkCart,
};
