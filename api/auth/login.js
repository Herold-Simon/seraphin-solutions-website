// Login endpoint for website authentication
export default function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ message: 'Benutzername und Passwort sind erforderlich' });
  }

  // In a real implementation, you would:
  // 1. Query your database for the user
  // 2. Hash the password and compare with stored hash
  // 3. Generate a JWT token
  
  // For this demo, we'll use a simple validation
  // In production, you should use proper authentication
  const validUsers = {
    // This would come from your database
    'admin': 'admin123', // username: password (in production, use hashed passwords)
    'demo': 'demo123'
  };

  if (validUsers[username] && validUsers[username] === password) {
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
