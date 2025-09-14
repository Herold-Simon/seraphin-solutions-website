// Statistics endpoint
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In-memory storage (in production, use a database)
const accounts = [];

// Load accounts from environment or use default
function loadAccounts() {
  if (accounts.length === 0) {
    accounts.push({
      id: 'default-account',
      name: 'Test Account',
      email: 'test@example.com',
      password: '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      apiKey: 'test-api-key-123',
      createdAt: new Date().toISOString(),
      lastSync: new Date().toISOString(),
      statistics: {
        totalVideos: 5,
        totalViews: 1250,
        todayViews: 45,
        mostViewedVideo: {
          id: 'video-1',
          title: 'Willkommen im Gebäude',
          views: 320
        },
        timeRangeInfo: {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          end: new Date().toISOString().split('T')[0],
          videosWithViews: 4,
          totalViews: 1250
        }
      },
      videos: [
        {
          id: 'video-1',
          title: 'Willkommen im Gebäude',
          subtitle: 'Einführung in das Gebäude',
          keywords: ['willkommen', 'einführung'],
          views: 320,
          lastViewed: Date.now() - 2 * 24 * 60 * 60 * 1000,
          createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
          type: 'video',
          url: 'video1.mp4'
        },
        {
          id: 'video-2',
          title: 'Stockwerk 1',
          subtitle: 'Überblick Stockwerk 1',
          keywords: ['stockwerk', '1'],
          views: 280,
          lastViewed: Date.now() - 1 * 24 * 60 * 60 * 1000,
          createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
          type: 'video',
          url: 'video2.mp4'
        },
        {
          id: 'video-3',
          title: 'Stockwerk 2',
          subtitle: 'Überblick Stockwerk 2',
          keywords: ['stockwerk', '2'],
          views: 240,
          lastViewed: Date.now() - 3 * 24 * 60 * 60 * 1000,
          createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
          type: 'video',
          url: 'video3.mp4'
        },
        {
          id: 'video-4',
          title: 'Cafeteria',
          subtitle: 'Informationen zur Cafeteria',
          keywords: ['cafeteria', 'essen'],
          views: 190,
          lastViewed: Date.now() - 5 * 24 * 60 * 60 * 1000,
          createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
          type: 'video',
          url: 'video4.mp4'
        },
        {
          id: 'video-5',
          title: 'Parkhaus',
          subtitle: 'Parkmöglichkeiten',
          keywords: ['parken', 'parkhaus'],
          views: 220,
          lastViewed: Date.now() - 4 * 24 * 60 * 60 * 1000,
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          type: 'video',
          url: 'video5.mp4'
        }
      ]
    });
  }
}

// Middleware to verify JWT token
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Kein Token bereitgestellt' 
    });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'mein-jwt-geheimschlüssel-456');
    req.accountId = decoded.accountId;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Ungültiger Token' 
    });
  }
}

// Get statistics for account
router.get('/:accountId', verifyToken, (req, res) => {
  try {
    loadAccounts();
    
    const { accountId } = req.params;
    const { timeRange } = req.query;
    
    // Verify account access
    if (req.accountId !== accountId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Kein Zugriff auf diese Statistiken' 
      });
    }
    
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Konto nicht gefunden' 
      });
    }
    
    // Filter statistics by time range if needed
    let statistics = account.statistics;
    if (timeRange && timeRange !== 'all') {
      // In a real app, you'd filter the data by time range
      statistics = {
        ...account.statistics,
        timeRangeInfo: {
          ...account.statistics.timeRangeInfo,
          // Add time range filtering logic here
        }
      };
    }
    
    res.json({
      success: true,
      statistics,
      timeRange: timeRange || 'all'
    });
    
  } catch (error) {
    console.error('Statistics fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Serverfehler beim Laden der Statistiken' 
    });
  }
});

// Update statistics for account
router.post('/:accountId/update', verifyToken, (req, res) => {
  try {
    loadAccounts();
    
    const { accountId } = req.params;
    const { statistics, videos, lastSync } = req.body;
    
    // Verify account access
    if (req.accountId !== accountId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Kein Zugriff auf diese Statistiken' 
      });
    }
    
    const accountIndex = accounts.findIndex(acc => acc.id === accountId);
    if (accountIndex === -1) {
      return res.status(404).json({ 
        success: false, 
        message: 'Konto nicht gefunden' 
      });
    }
    
    // Update account data
    if (statistics) {
      accounts[accountIndex].statistics = statistics;
    }
    if (videos) {
      accounts[accountIndex].videos = videos;
    }
    if (lastSync) {
      accounts[accountIndex].lastSync = lastSync;
    }
    
    res.json({
      success: true,
      message: 'Statistiken erfolgreich aktualisiert',
      lastSync: accounts[accountIndex].lastSync
    });
    
  } catch (error) {
    console.error('Statistics update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Serverfehler beim Aktualisieren der Statistiken' 
    });
  }
});

module.exports = router;
