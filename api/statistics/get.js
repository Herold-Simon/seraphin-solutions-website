// Statistics retrieval endpoint
export default function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Kein gültiger Token' });
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify token
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [username, timestamp] = decoded.split(':');
    
    const tokenAge = Date.now() - parseInt(timestamp);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      return res.status(401).json({ message: 'Token abgelaufen' });
    }
    
    // In a real implementation, you would:
    // 1. Query your database for the user's statistics
    // 2. Return the latest statistics for that user's device
    
    // For this demo, return mock statistics
    const mockStatistics = {
      deviceId: 'demo-device-001',
      username: username,
      statistics: {
        videos: [
          {
            id: '1',
            title: 'Eingangsbereich',
            views: 45,
            lastViewed: Date.now() - 1000 * 60 * 30 // 30 minutes ago
          },
          {
            id: '2',
            title: 'Bürobereich',
            views: 32,
            lastViewed: Date.now() - 1000 * 60 * 15 // 15 minutes ago
          },
          {
            id: '3',
            title: 'Konferenzraum',
            views: 28,
            lastViewed: Date.now() - 1000 * 60 * 45 // 45 minutes ago
          },
          {
            id: '4',
            title: 'Cafeteria',
            views: 19,
            lastViewed: Date.now() - 1000 * 60 * 60 // 1 hour ago
          }
        ],
        floors: [
          { id: '1', name: 'Erdgeschoss', rooms: 12 },
          { id: '2', name: '1. Obergeschoss', rooms: 8 },
          { id: '3', name: '2. Obergeschoss', rooms: 6 }
        ],
        timeRangeStart: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
        timeRangeEnd: Date.now(),
        pieChartVideoCount: 4,
        lineChartVideoCount: 4,
        barChartVideoCount: 4,
        lineRaceVideoCount: 4
      },
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(mockStatistics);
  } catch (error) {
    return res.status(401).json({ message: 'Ungültiger Token' });
  }
}
