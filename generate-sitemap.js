const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');

dotenv.config();

const Product = require('./models/Product');

const BASE_URL = 'https://card-vaults.vercel.app';

// Escape XML special characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '<';
            case '>': return '>';
            case '&': return '&';
            case "'": return "'";
            case '"': return '"';
        }
    });
}

// Generate XML sitemap
function generateSitemap(regularProducts = [], featuredProducts = []) {
    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
    xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
    xmlns:xhtml="http://www.w3.org/1999/xhtml">

    <!-- Homepage - Primary Target for card vault keyword - HIGH PRIORITY -->
    <url>
        <loc>${BASE_URL}/</loc>
        <changefreq>daily</changefreq>
        <priority>1.0</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Search/Browse Page - Gift Cards Collection -->
    <url>
        <loc>${BASE_URL}/search</loc>
        <changefreq>daily</changefreq>
        <priority>0.9</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Login Page -->
    <url>
        <loc>${BASE_URL}/login</loc>
        <changefreq>yearly</changefreq>
        <priority>0.5</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Register Page -->
    <url>
        <loc>${BASE_URL}/register</loc>
        <changefreq>yearly</changefreq>
        <priority>0.5</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Terms of Service -->
    <url>
        <loc>${BASE_URL}/terms</loc>
        <changefreq>monthly</changefreq>
        <priority>0.6</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Forgot Password -->
    <url>
        <loc>${BASE_URL}/forgot-password</loc>
        <changefreq>yearly</changefreq>
        <priority>0.3</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Wishlist Page (Protected but sitemap needed for SEO) -->
    <url>
        <loc>${BASE_URL}/wishlist</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Orders Page (Protected but sitemap needed) -->
    <url>
        <loc>${BASE_URL}/orders</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Profile Page (Protected but sitemap needed) -->
    <url>
        <loc>${BASE_URL}/profile</loc>
        <changefreq>monthly</changefreq>
        <priority>0.5</priority>
        <lastmod>${today}</lastmod>
    </url>

    <!-- Note: /payment and /admin/dashboard are excluded from sitemap (disallowed in robots.txt) -->

    <!-- 404 Not Found Page -->
    <url>
        <loc>${BASE_URL}/404</loc>
        <changefreq>yearly</changefreq>
        <priority>0.1</priority>
        <lastmod>${today}</lastmod>
    </url>

`;

    // Add regular product pages
    if (regularProducts && regularProducts.length > 0) {
        xml += `    <!-- Regular Product Pages -->\n`;
        regularProducts.forEach(product => {
            const image = product.image ? `
        <image:image>
            <image:loc>${product.image}</image:loc>
            <image:title>${escapeXml(product.name || '')}</image:title>
            <image:caption>Buy ${escapeXml(product.name || '')} gift card on Card Vault</image:caption>
        </image:image>` : '';

            xml += `    <url>
        <loc>${BASE_URL}/product/${product._id || product.id}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.7</priority>
        <lastmod>${today}</lastmod>${image}
    </url>
`;
        });
    }

    // Add featured product pages
    if (featuredProducts && featuredProducts.length > 0) {
        xml += `\n    <!-- Featured Product Pages -->\n`;
        featuredProducts.forEach(product => {
            const image = product.image ? `
        <image:image>
            <image:loc>${product.image}</image:loc>
            <image:title>${escapeXml(product.name || '')} - Featured</image:title>
            <image:caption>Featured: ${escapeXml(product.name || '')} gift card on Card Vault</image:caption>
        </image:image>` : '';

            xml += `    <url>
        <loc>${BASE_URL}/featured-product/${product._id || product.id}</loc>
        <changefreq>weekly</changefreq>
        <priority>0.8</priority>
        <lastmod>${today}</lastmod>${image}
    </url>
`;
        });
    }

    xml += `\n</urlset>`;
    return xml;
}

async function generateSitemapFile() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Fetch regular products (type is not 'featured' or type is undefined/null)
        const regularProducts = await Product.find({
            $or: [
                { type: { $ne: 'featured' } },
                { type: { $exists: false } },
                { type: null }
            ]
        }).limit(1000).lean();

        // Fetch featured products (type is 'featured')
        const featuredProducts = await Product.find({
            type: 'featured'
        }).limit(1000).lean();

        console.log(`Found ${regularProducts.length} regular products and ${featuredProducts.length} featured products`);
        console.log('Regular product IDs:', regularProducts.map(p => p.id || p._id));
        console.log('Featured product IDs:', featuredProducts.map(p => p.id || p._id));

        // Generate sitemap XML
        const sitemapXml = generateSitemap(regularProducts, featuredProducts);

        // Write to frontend/public/sitemap.xml
        const outputPath = path.join(__dirname, '..', 'frontend', 'public', 'sitemap.xml');
        fs.writeFileSync(outputPath, sitemapXml, 'utf8');

        console.log(`Sitemap generated successfully at: ${outputPath}`);
        console.log(`Total URLs: ${regularProducts.length + featuredProducts.length + 10} (products + static pages)`);

        // Disconnect from MongoDB
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('Error generating sitemap:', error);
        process.exit(1);
    }
}

// Run the script
generateSitemapFile();
