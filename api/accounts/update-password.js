// Password update endpoint for website synchronization
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

  const { deviceId, username, newPassword } = req.body;

  // Validate input
  if (!deviceId || !username || !newPassword) {
    return res.status(400).json({ message: 'Alle Felder sind erforderlich' });
  }

  // Aktualisiere das Passwort in der Account-Store
  const { getAllAccounts } = require('../auth/account-store');
  const accounts = getAllAccounts();
  const account = accounts.find(acc => acc.username === username && acc.deviceId === deviceId);
  
  if (account) {
    account.password = newPassword;
    console.log(`Password updated for account: ${username}`);
  }

  console.log('Password update request:', {
    username,
    deviceId,
    passwordLength: newPassword.length,
    updated: !!account,
    timestamp: new Date().toISOString()
  });

  if (account) {
    return res.status(200).json({
      message: 'Passwort erfolgreich aktualisiert',
      timestamp: new Date().toISOString()
    });
  } else {
    return res.status(404).json({
      message: 'Konto nicht gefunden'
    });
  }
}
