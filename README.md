# Card Vault Backend API

A robust REST API backend for the Card Vault digital gift card management platform, built with Node.js, Express.js, and MongoDB.

## 📋 Overview

The Card Vault Backend provides a comprehensive API for managing digital gift cards, user authentication, orders, wishlists, shopping carts, payments, and more. It features JWT-based authentication, secure payment processing, automated expiry management, and email notifications.

## ✨ Features

- **JWT Authentication**: Secure user authentication and authorization
- **Product Management**: Complete CRUD operations for gift cards
- **Order Processing**: Full order lifecycle management
- **Shopping Cart & Wishlist**: Persistent cart and wishlist functionality
- **Payment Integration**: UPI payment processing
- **Email Notifications**: Automated email alerts for orders, expiry notifications, and user reminders
- **Automated Expiry Management**: Scheduled checks for expiring products
- **User Reminder System**: Automated emails for empty carts and available wishlist items
- **Newsletter Subscription**: Email marketing capabilities
- **Admin Dashboard**: Administrative controls and analytics
- **Image Upload**: Cloudinary integration for product images

- **CORS Support**: Configured for cross-origin requests

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JSON Web Tokens (JWT)
- **Password Hashing**: bcryptjs
- **File Upload**: Multer
- **Image Storage**: Cloudinary
- **Email Service**: Nodemailer
- **Scheduling**: node-cron
- **CORS**: cors middleware
- **Deployment**: Vercel (serverless functions)

## 🚀 Getting Started

### Prerequisites

- Node.js 16.x or higher
- npm 8.x or higher
- MongoDB Atlas account (or local MongoDB)
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/card-vault.git
cd card-vault/backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## 🔧 Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://your_mongodb_connection_string

# JWT Authentication
JWT_SECRET=your_super_secure_jwt_secret_key

# Default Admin Email (cannot be deleted or have role changed)
DEFAULT_ADMIN_EMAIL=admin_email_here

# UPI Payment Settings
UPI_ID=your-upi-id@bank
UPI_MERCHANT_NAME=merchant_name_here

# Email Configuration (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=Card Vault <your_email@gmail.com>
```

## 🏗️ Project Structure

```
backend/
├── api/                    # Vercel serverless functions
│   ├── auth.js            # Authentication endpoints
│   ├── products.js        # Product management
│   ├── orders.js          # Order processing
│   ├── users.js           # User management
│   ├── cart.js            # Shopping cart
│   ├── wishlist.js        # Wishlist functionality
│   ├── payment.js         # Payment processing
│   ├── newsletter.js      # Email subscriptions
│   ├── reminders.js       # User reminders (cart/wishlist)
│   ├── email.js           # Email utilities
│   ├── _lib/              # Shared utilities
│   └── _models/           # Database models (Vercel)
├── controllers/           # Business logic controllers
├── models/                # Mongoose schemas
├── routes/                # Express routes
├── middleware/            # Custom middleware
├── services/              # Background services
├── uploads/               # File upload directory
├── server.js              # Express server entry point
├── package.json
├── .env.example
└── vercel.json           # Vercel deployment config
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset confirmation
- `GET /api/auth/verify` - Token verification

### Product Endpoints

- `GET /api/products` - Get all products (with filtering/pagination)
- `GET /api/products/:id` - Get specific product
- `POST /api/products` - Create new product (Admin only)
- `PUT /api/products/:id` - Update product (Admin only)
- `DELETE /api/products/:id` - Delete product (Admin only)
- `GET /api/products/search` - Search products

### Order Endpoints

- `GET /api/orders` - Get user orders
- `GET /api/orders/:id` - Get specific order
- `POST /api/orders` - Create new order
- `PUT /api/orders/:id/status` - Update order status (Admin only)

### Cart Endpoints

- `GET /api/cart` - Get user's cart
- `POST /api/cart` - Add item to cart
- `PUT /api/cart/:itemId` - Update cart item quantity
- `DELETE /api/cart/:itemId` - Remove item from cart
- `DELETE /api/cart` - Clear entire cart

### Wishlist Endpoints

- `GET /api/wishlist` - Get user's wishlist
- `POST /api/wishlist` - Add product to wishlist
- `DELETE /api/wishlist/:productId` - Remove from wishlist

### User Management

- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile
- `GET /api/users` - Get all users (Admin only)
- `PUT /api/users/:id/role` - Change user role (Admin only)

### Payment & Newsletter

- `POST /api/payment/initiate` - Initiate UPI payment
- `POST /api/newsletter/subscribe` - Subscribe to newsletter

### Utility Endpoints

- `POST /api/reminders` - Send user reminders (empty cart, wishlist items)
- `POST /api/trigger-expiry-check` - Manual expiry check (testing)
- `POST /api/trigger-expiry-stock-update` - Manual stock update (testing)

## ⏰ Scheduled Tasks

The application includes automated scheduled tasks that run on Vercel:

- **Daily Expiry Check** (10:00 AM): Automatically checks for expired products and updates their status
- **User Reminders** (2:00 PM): Sends friendly reminder emails for empty carts and available wishlist items

## 🗄️ Database Models

### User Model
- Personal information (name, email, phone)
- Authentication (password hash, JWT tokens)
- Role management (user/admin)
- Wallet balance
- Order history reference

### Product Model
- Basic info (name, brand, description, price)
- Inventory (stock, SKU)
- Categories and tags
- Validity dates
- Image URLs (Cloudinary)
- Featured product status

### Order Model
- User reference
- Product items with quantities
- Order status and tracking
- Payment information
- Shipping details
- Timestamps

### Cart & Wishlist Models
- User association
- Product references
- Quantities and timestamps

## 🔐 Authentication & Security

- **JWT Tokens**: Access tokens with expiration
- **Password Security**: bcrypt hashing with salt rounds
- **Protected Routes**: Middleware for authentication checks
- **Role-Based Access**: Admin vs regular user permissions
- **Input Validation**: Request sanitization and validation
- **CORS Configuration**: Secure cross-origin policies
- **Rate Limiting**: Protection against abuse

## 📧 Email System

- **Order Confirmations**: Automated emails for new orders
- **Expiry Notifications**: Alerts for expiring gift cards
- **Password Reset**: Secure reset link emails
- **Newsletter**: Marketing email subscriptions

## ⏰ Automated Tasks

- **Expiry Scheduler**: Daily checks for expiring products
- **Stock Updates**: Automatic stock reduction for expired items
- **Email Notifications**: Scheduled alerts to users

## 🚀 Deployment

### Vercel Deployment

The backend is optimized for Vercel serverless functions:

1. Connect your GitHub repository to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on git push

### Local Development

```bash
# Development mode with nodemon
npm run dev

# Production mode
npm start



## 🧪 Testing & Development

### Seeding Data

```bash
node seeder.js
```

### Admin Setup

```bash
node update-admin.js
```

### API Testing

Use tools like Postman or Insomnia to test API endpoints. Import the provided collection for all available endpoints.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 🙌 Acknowledgments

- Express.js team for the robust web framework
- MongoDB community for excellent documentation
- Vercel for seamless serverless deployment
- Open source contributors worldwide

---

*Built with ❤️ to power the Card Vault digital gift card experience*