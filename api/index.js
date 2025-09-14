// Main API entry point
const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Gebäudenavi API is running',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/auth/login', require('./auth/login'));
app.use('/auth/create-account', require('./auth/create-account'));
app.use('/statistics', require('./statistics'));
app.use('/videos', require('./videos'));
app.use('/charts', require('./charts'));

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Endpoint nicht gefunden' 
  });
});

// Error handler
app.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({ 
    success: false, 
    message: 'Interner Serverfehler' 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API Server running on port ${PORT}`);
});

module.exports = app;
