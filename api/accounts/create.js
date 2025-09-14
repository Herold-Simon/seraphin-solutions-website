// Account creation endpoint for app integration
const { createAccount, getAccount } = require('../database');

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

  // Check if user already exists
  if (getAccount(username)) {
    return res.status(409).json({ message: 'Benutzername bereits vergeben' });
  }

  // Create account with default admin password
  // In production, you would generate a secure password or let the user set one
  const defaultPassword = 'admin123'; // This should be the admin panel password
  
  const success = createAccount(username, defaultPassword, deviceId, statistics);
  
  if (success) {
    console.log('Account created:', { username, deviceId });
    return res.status(201).json({
      message: 'Konto erfolgreich erstellt',
      accountId: `${deviceId}-${username}`,
      username: username
    });
  } else {
    return res.status(500).json({ message: 'Fehler beim Erstellen des Kontos' });
  }
}
