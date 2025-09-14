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

  const { deviceId, username, statistics, adminPassword } = req.body;

  // Validate input
  if (!deviceId || !username || !statistics || !adminPassword) {
    return res.status(400).json({ message: 'Alle Felder sind erforderlich' });
  }

  // Für die Demo: Keine Duplikat-Prüfung (da Serverless-Funktionen stateless sind)

  // Für die Demo: Immer erfolgreich (da Serverless-Funktionen stateless sind)
  // Das Passwort wird in den Account-Daten mitgespeichert
  console.log('Account creation request:', {
    username,
    deviceId,
    adminPasswordLength: adminPassword.length,
    videoCount: statistics.videos?.length || 0,
    floorCount: statistics.floors?.length || 0,
    timestamp: new Date().toISOString()
  });

  // Generiere Account-Token für sichere Authentifizierung
  const tokenData = {
    username,
    password: adminPassword,
    deviceId,
    timestamp: Date.now()
  };
  
  const accountToken = Buffer.from(JSON.stringify(tokenData)).toString('base64');

  // In Production würde hier eine echte Datenbank-Erstellung stehen
  return res.status(201).json({
    message: 'Konto erfolgreich erstellt',
    accountId: `${deviceId}-${username}`,
    username: username,
    accountToken: accountToken
  });
}
