// Login endpoint
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In-memory storage (in production, use a database)
const accounts = [];

// Load accounts from environment or use default
function loadAccounts() {
  // In production, load from database
  // For now, we'll use environment variables or create a default account
  if (accounts.length === 0) {
    // Create a default account for testing
    accounts.push({
      id: 'default-account',
      name: 'Test Account',
      email: 'test@example.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', // password: password
      apiKey: 'test-api-key-123',
      createdAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      statistics: {
        totalVideos: 0,
        totalViews: 0,
        todayViews: 0,
        mostViewedVideo: null,
        timeRangeInfo: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0],
          videosWithViews: 0,
          totalViews: 0
        }
      },
      videos: []
    });
  }
}

router.post('/login', async (req, res) => {
  try {
    loadAccounts();
    
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'E-Mail und Passwort sind erforderlich' 
      });
    }
    
    // Find account
    const account = accounts.find(acc => acc.email === email);
    if (!account) {
      return res.status(401).json({ 
        success: false, 
        message: 'Ungültige Anmeldedaten' 
      });
    }
    
    // Check password
    const validPassword = await bcrypt.compare(password, account.password);
    if (!validPassword) {
      return res.status(401).json({ 
        success: false, 
        message: 'Ungültige Anmeldedaten' 
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        accountId: account.id, 
        email: account.email 
      },
      process.env.JWT_SECRET || 'mein-jwt-geheimschlüssel-456',
      { expiresIn: '24h' }
    );
    
    res.json({
      success: true,
      token,
      accountId: account.id,
      name: account.name,
      email: account.email
    });
    
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Serverfehler beim Anmelden' 
    });
  }
});

module.exports = router;
