// Statistics update endpoint for app synchronization
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

  // Für die Demo: Akzeptiere alle Statistiken-Updates
  // In Production würde hier eine echte Datenbank-Aktualisierung stehen
  console.log('Statistics update received:', {
    username,
    deviceId,
    videoCount: statistics.videos?.length || 0,
    floorCount: statistics.floors?.length || 0,
    timestamp: new Date().toISOString()
  });

  return res.status(200).json({
    message: 'Statistiken erfolgreich aktualisiert',
    timestamp: new Date().toISOString()
  });
}
