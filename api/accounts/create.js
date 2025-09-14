// Account creation endpoint for app integration
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

  const { deviceId, username, statistics } = req.body;

  // Validate input
  if (!deviceId || !username || !statistics) {
    return res.status(400).json({ message: 'Alle Felder sind erforderlich' });
  }

  // For demo: Always accept account creation (no database persistence)
  console.log('Account creation request:', {
    username,
    deviceId,
    videoCount: statistics.videos?.length || 0,
    floorCount: statistics.floors?.length || 0
  });

  return res.status(201).json({
    message: 'Konto erfolgreich erstellt',
    accountId: `${deviceId}-${username}`,
    username: username
  });
}
