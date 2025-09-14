// Account deletion endpoint for website integration
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

  const { deviceId, username } = req.body;

  // Validate input
  if (!deviceId || !username) {
    return res.status(400).json({ message: 'Alle Felder sind erforderlich' });
  }

  // Für die Demo: Akzeptiere alle Löschungen
  // In Production würde hier eine echte Datenbank-Löschung stehen
  console.log('Account deletion request:', {
    username,
    deviceId,
    timestamp: new Date().toISOString()
  });

  return res.status(200).json({
    message: 'Konto erfolgreich gelöscht',
    timestamp: new Date().toISOString()
  });
}
