const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Product = require('./models/Product');
const User = require('./models/User');

dotenv.config();

const initialProducts = [
    {
        id: '01010101',
        brand: 'Croma',
        name: 'Croma Gift Card',
        denomination: 'Rs.400',
        value: 400,
        currency: 'INR',
        category: 'apps',
        image: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=400&h=250&fit=crop',
        description: 'Redeem for the latest electronics, appliances, and gadgets at any Croma store.',
        price: 400.00,
        createdDateTime: '2026-02-20T10:00:00Z',
        validityEndDateTime: '2027-02-20T23:59:59Z',
        inStock: true,
        stock: 10,
        popular: true,
    },
    {
        id: '01010102',
        brand: 'Amazon',
        name: 'Amazon Pay Gift Card',
        denomination: 'Rs.1000',
        value: 1000,
        currency: 'INR',
        category: 'shopping',
        image: 'https://images.unsplash.com/photo-1523474253046-2cd2c78b6ad1?w=400&h=250&fit=crop',
        description: 'Use for millions of items on Amazon.in.',
        price: 1000.00,
        createdDateTime: '2026-02-21T10:00:00Z',
        validityEndDateTime: '2027-02-21T23:59:59Z',
        inStock: true,
        stock: 50,
        popular: true,
    }
];

const seedDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB for seeding...');

        await Product.deleteMany();
        await Product.insertMany(initialProducts);
        console.log('Products seeded successfully');

        // Note: Create admin user using update-admin.js script
        // Run: node update-admin.js <email> <password>
        console.log('To create/update admin user, run: node update-admin.js <email> <password>');

        process.exit();
    } catch (err) {
        console.error('Seeding error:', err);
        process.exit(1);
    }
};

seedDB();
