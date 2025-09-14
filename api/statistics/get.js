// Statistics retrieval endpoint
const { getStatistics, getAccount } = require('../database');

module.exports = function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Kein gültiger Token' });
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, timestamp] = decoded.split(':');
    
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return res.status(401).json({ message: 'Token abgelaufen' });
    }
    
    // Get user account to verify it exists
    const user = getAccount(username);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Benutzer nicht gefunden oder inaktiv' });
    }
    
    // Get statistics from database
    const statistics = getStatistics(username);
    if (!statistics) {
      return res.status(404).json({ message: 'Keine Statistiken für diesen Benutzer gefunden' });
    }

    return res.status(200).json({
      deviceId: user.deviceId,
      username: username,
      statistics: statistics,
      timestamp: statistics.lastUpdated || new Date().toISOString()
    });
  } catch (error) {
    return res.status(401).json({ message: 'Ungültiger Token' });
  }
}
