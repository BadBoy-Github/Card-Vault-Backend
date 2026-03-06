const connectDB = require('./_lib/db');

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

    const { method } = req;

    // GET /api/payment/config - Get payment configuration (public)
    if (method === 'GET') {
        try {
            const upiId = process.env.UPI_ID || '';
            const merchantName = process.env.UPI_MERCHANT_NAME || 'CardVault';
            const qrImageUrl = process.env.UPI_QR_IMAGE_URL || '';

            return res.status(200).json({
                upiId: upiId,
                merchantName: merchantName,
                qrImageUrl: qrImageUrl,
                paymentInstructions: [
                    'Scan the QR code using any UPI app (GPay, PhonePe, Paytm)',
                    'Enter the exact amount shown',
                    'After payment, enter the UTR/Transaction ID',
                    'Wait for payment verification'
                ]
            });
        } catch (error) {
            return res.status(500).json({ message: error.message });
        }
    }

    return res.status(405).json({ message: 'Method not allowed' });
};
