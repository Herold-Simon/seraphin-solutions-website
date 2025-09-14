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

  // In a real implementation, you would:
  // 1. Store the account in your database
  // 2. Hash the admin password for security
  // 3. Validate the statistics data
  
  // For this demo, we'll simulate account creation
  const accountData = {
    deviceId: deviceId,
    username: username,
    statistics: statistics,
    createdAt: new Date().toISOString(),
    isActive: true
  };

  // In production, save to database
  console.log('Account created:', accountData);

  return res.status(201).json({
    message: 'Konto erfolgreich erstellt',
    accountId: `${deviceId}-${username}`,
    username: username
  });
}
