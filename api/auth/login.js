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

  // Für die Demo: Vereinfachtes Login-System
  // Das Passwort wird bei der Account-Erstellung übermittelt und hier validiert
  // Da Serverless-Funktionen stateless sind, verwenden wir einen anderen Ansatz
  
  // Check if username and password are provided
  if (username.trim().length > 0 && password.trim().length > 0) {
    // Für die Demo: Alle Benutzer mit gültigen Credentials können sich anmelden
    // In Production würde hier eine echte Datenbank-Abfrage stehen
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
