// Create account endpoint
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage (in production, use a database)
const accounts = [];

router.post('/create-account', async (req, res) => {
  try {
    const adminKey = req.headers['x-admin-key'];
    
    // Check admin key
    const validAdminKey = process.env.ADMIN_API_KEY || 'mein-sicherer-admin-schlüssel-123';
    if (adminKey !== validAdminKey) {
      return res.status(401).json({ 
        success: false, 
        message: 'Ungültiger Admin-API-Schlüssel' 
      });
    }
    
    const { name, email, password, statistics, videos } = req.body;
    
    if (!name || !email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, E-Mail und Passwort sind erforderlich' 
      });
    }
    
    // Check if email already exists
    const existingAccount = accounts.find(acc => acc.email === email);
    if (existingAccount) {
      return res.status(409).json({ 
        success: false, 
        message: 'E-Mail-Adresse bereits vergeben' 
      });
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generate API key
    const apiKey = `api_${uuidv4().replace(/-/g, '')}`;
    
    // Create account
    const newAccount = {
      id: uuidv4(),
      name,
      email,
      password: hashedPassword,
      apiKey,
      createdAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      statistics: statistics || {
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
      videos: videos || []
    };
    
    accounts.push(newAccount);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        accountId: newAccount.id, 
        email: newAccount.email 
      },
      process.env.JWT_SECRET || 'mein-jwt-geheimschlüssel-456',
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      success: true,
      message: 'Konto erfolgreich erstellt',
      account: {
        id: newAccount.id,
        name: newAccount.name,
        email: newAccount.email,
        apiKey: newAccount.apiKey,
        createdAt: newAccount.createdAt,
        lastSync: newAccount.lastSync
      },
      token
    });
    
  } catch (error) {
    console.error('Account creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Serverfehler beim Erstellen des Kontos' 
    });
  }
});

module.exports = router;
