// Statistics update endpoint for app synchronization
const { updateStatistics, getAccount } = require('../database');

module.exports = function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { deviceId, username, statistics, timestamp } = req.body;

  // Validate input
  if (!deviceId || !username || !statistics) {
    return res.status(400).json({ message: 'Alle Felder sind erforderlich' });
  }

  // Verify user exists and device ID matches
  const user = getAccount(username);
  if (!user || user.deviceId !== deviceId) {
    return res.status(403).json({ message: 'Geräte-ID stimmt nicht überein' });
  }

  // Update statistics in database
  const success = updateStatistics(username, statistics);
  
  if (success) {
    console.log('Statistics updated for user:', username);
    return res.status(200).json({
      message: 'Statistiken erfolgreich aktualisiert',
      timestamp: new Date().toISOString()
    });
  } else {
    return res.status(500).json({ message: 'Fehler beim Aktualisieren der Statistiken' });
  }
}
