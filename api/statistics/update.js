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

  // In a real implementation, you would:
  // 1. Verify the device ID belongs to the user
  // 2. Update the statistics in your database
  // 3. Validate the statistics data format
  
  // For this demo, we'll simulate statistics update
  const updateData = {
    deviceId: deviceId,
    username: username,
    statistics: statistics,
    updatedAt: new Date().toISOString(),
    timestamp: timestamp
  };

  // In production, update database
  console.log('Statistics updated:', updateData);

  return res.status(200).json({
    message: 'Statistiken erfolgreich aktualisiert',
    timestamp: new Date().toISOString()
  });
}
