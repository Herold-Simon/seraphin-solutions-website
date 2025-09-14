// Charts endpoint
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

// Get chart data for account
router.get('/:accountId/:chartType', verifyToken, (req, res) => {
  try {
    loadAccounts();
    
    const { accountId, chartType } = req.params;
    const { timeRange } = req.query;
    
    // Verify account access
    if (req.accountId !== accountId) {
      return res.status(403).json({ 
        success: false, 
        message: 'Kein Zugriff auf diese Diagramme' 
      });
    }
    
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) {
      return res.status(404).json({ 
        success: false, 
        message: 'Konto nicht gefunden' 
      });
    }
    
    const videos = account.videos || [];
    
    // Generate chart data based on chart type
    let chartData;
    
    switch (chartType) {
      case 'line':
        chartData = generateLineChartData(videos, timeRange);
        break;
      case 'pie':
        chartData = generatePieChartData(videos, timeRange);
        break;
      case 'bar':
        chartData = generateBarChartData(videos, timeRange);
        break;
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Ungültiger Diagrammtyp' 
        });
    }
    
    res.json({
      success: true,
      chartType,
      timeRange: timeRange || 'all',
      data: chartData
    });
    
  } catch (error) {
    console.error('Chart data fetch error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Serverfehler beim Laden der Diagramm-Daten' 
    });
  }
});

// Generate line chart data
function generateLineChartData(videos, timeRange) {
  const last30Days = [];
  const now = new Date();
  
  // Generate last 30 days
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    last30Days.push(date.toISOString().split('T')[0]);
  }
  
  // Create datasets for top 3 videos
  const topVideos = videos
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 3);
  
  const datasets = topVideos.map((video, index) => {
    const color = ['#667eea', '#764ba2', '#f093fb'][index];
    const data = last30Days.map(date => {
      // Simulate daily views (in real app, use viewHistory)
      const baseViews = Math.floor((video.views || 0) / 30);
      const randomFactor = 0.5 + Math.random();
      return Math.floor(baseViews * randomFactor);
    });
    
    return {
      label: video.title,
      data: data,
      borderColor: color,
      backgroundColor: color + '20',
      tension: 0.4,
      fill: false
    };
  });
  
  return {
    labels: last30Days.map(date => {
      const d = new Date(date);
      return `${d.getDate()}.${d.getMonth() + 1}`;
    }),
    datasets: datasets
  };
}

// Generate pie chart data
function generatePieChartData(videos, timeRange) {
  const topVideos = videos
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 5);
  
  return {
    labels: topVideos.map(video => video.title),
    values: topVideos.map(video => video.views || 0)
  };
}

// Generate bar chart data
function generateBarChartData(videos, timeRange) {
  const topVideos = videos
    .sort((a, b) => (b.views || 0) - (a.views || 0))
    .slice(0, 10);
  
  return {
    labels: topVideos.map(video => video.title),
    values: topVideos.map(video => video.views || 0)
  };
}

module.exports = router;
