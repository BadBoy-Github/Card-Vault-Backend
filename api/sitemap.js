// Dynamic Sitemap Generator for SEO
// This generates XML sitemap dynamically based on products in the database

const express = require('express');
const router = express.Router();

// Static pages that should always be in sitemap
const staticPages = [
    { loc: '/', changefreq: 'daily', priority: 1.0 },
    { loc: '/search', changefreq: 'weekly', priority: 0.9 },
    { loc: '/wishlist', changefreq: 'weekly', priority: 0.8 },
    { loc: '/orders', changefreq: 'weekly', priority: 0.8 },
    { loc: '/contact', changefreq: 'monthly', priority: 0.8 },
    { loc: '/login', changefreq: 'monthly', priority: 0.6 },
    { loc: '/register', changefreq: 'monthly', priority: 0.6 },
    { loc: '/terms', changefreq: 'monthly', priority: 0.5 },
];

// Base URL for the site
const BASE_URL = 'https://card-vaults.vercel.app';

// Generate XML sitemap
function generateSitemap(products = []) {
    const today = new Date().toISOString().split('T')[0];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" 
         xmlns:xhtml="http://www.w3.org/1999/xhtml"
         xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
         xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
`;

    // Add static pages
    staticPages.forEach(page => {
        xml += `  <url>
    <loc>${BASE_URL}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
    <lastmod>${today}</lastmod>
  </url>
`;
    });

    // Add dynamic product pages
    if (products && products.length > 0) {
        products.forEach(product => {
            const url = `/product/${product._id || product.id}`;
            const image = product.image ? `<image:image>
      <image:loc>${product.image}</image:loc>
      <image:title>${escapeXml(product.name || '')}</image:title>
    </image:image>` : '';

            xml += `  <url>
    <loc>${BASE_URL}${url}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
    <lastmod>${today}</lastmod>
    ${image}
  </url>
`;
        });
    }

    xml += '</urlset>';
    return xml;
}

// Escape XML special characters
function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '<';
            case '>': return '>';
            case '&': return '&';
            case '\'': return ''';
            case '"': return '"';
        }
    });
}

// GET /api/sitemap.xml - Generate XML sitemap
router.get('/', async (req, res) => {
    try {
        // Try to fetch products from database
        let products = [];

        try {
            // Attempt to get products from the database
            // This assumes the Product model is available
            const Product = require('../models/Product');
            products = await Product.find({ active: true }).limit(1000).lean();
        } catch (dbError) {
            console.log('Could not fetch products for sitemap, using static pages only');
            // If database is not available, just serve static pages
        }

        // Set proper headers for XML
        res.set('Content-Type', 'application/xml');
        res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

        // Send the sitemap
        res.send(generateSitemap(products));
    } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('Error generating sitemap');
    }
});

// GET /api/sitemap - Generate JSON sitemap (alternative format)
router.get('/json', async (req, res) => {
    try {
        let products = [];

        try {
            const Product = require('../models/Product');
            products = await Product.find({ active: true }).limit(1000).lean();
        } catch (dbError) {
            console.log('Could not fetch products for sitemap');
        }

        const sitemap = {
            baseUrl: BASE_URL,
            lastModified: new Date().toISOString(),
            pages: staticPages,
            products: products.map(p => ({
                url: `/product/${p._id || p.id}`,
                name: p.name,
                image: p.image
            }))
        };

        res.json(sitemap);
    } catch (error) {
        console.error('Sitemap JSON generation error:', error);
        res.status(500).json({ error: 'Error generating sitemap' });
    }
});

module.exports = router;
