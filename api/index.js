// Vercel serverless giriş noktası — Express uygulamasını handler olarak export eder.
// /api/* istekleri (vercel.json rewrite ile) buraya gelir; statik dosyaları Vercel sunar.
module.exports = require('../server.js');
