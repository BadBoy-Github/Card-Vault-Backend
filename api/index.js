export default function handler(req, res) {
    // CORS headers
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    return res.status(200).json({
        message: 'Card Vault API is running',
        endpoints: [
            '/api/auth',
            '/api/products',
            '/api/wishlist',
            '/api/orders',
            '/api/users'
        ]
    });
}
