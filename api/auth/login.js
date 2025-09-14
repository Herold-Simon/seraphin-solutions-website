// Login endpoint for website authentication
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

  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ message: 'Benutzername und Passwort sind erforderlich' });
  }

  // Für die Demo: Alle Benutzer mit dem Admin-Passwort können sich anmelden
  // In Production würde hier eine echte Datenbank-Abfrage stehen
  const validPassword = 'admin123';
  
  // Check if password matches (any username is allowed for demo)
  if (password === validPassword && username.trim().length > 0) {
    // Generate a simple token (in production, use JWT)
    const token = Buffer.from(`${username}:${Date.now()}`).toString('base64');
    
    // In production, store this in a database with expiration
    return res.status(200).json({
      message: 'Erfolgreich angemeldet',
      token: token,
      username: username
    });
  } else {
    return res.status(401).json({ message: 'Ungültige Anmeldedaten' });
  }
}
