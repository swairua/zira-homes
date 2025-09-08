const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

// Security middleware
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist'), {
  maxAge: '1y',
  etag: true
}));

// API routes (if you have a backend API)
app.use('/api', (req, res, next) => {
  // Proxy to your backend API or handle API routes
  res.status(404).json({ error: 'API endpoint not found' });
});

// SPA fallback - serve index.html for all non-API, non-static routes
app.get(/^\/(?!api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});