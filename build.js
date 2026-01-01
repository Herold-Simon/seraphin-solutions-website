// Build-Script für Vercel Deployment
// Kopiert alle statischen Dateien in das public-Verzeichnis

const fs = require('fs');
const path = require('path');

// Erstelle public-Verzeichnis falls es nicht existiert
const publicDir = path.join(__dirname, 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Funktion zum rekursiven Kopieren von Verzeichnissen
function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

// Dateien und Verzeichnisse, die kopiert werden sollen
const itemsToCopy = [
  '*.html',
  '*.css',
  '*.js',
  '*.json',
  '*.png',
  '*.jpg',
  '*.jpeg',
  '*.gif',
  '*.svg',
  '*.ico',
  '*.txt',
  '*.xml',
  'api',
  'Wegbeschreibungen',
  'favicon.ico',
  'favicon.png',
  'logo.png',
  '16x16.png',
  '32x32.png',
  '1.png',
  '2.png',
  '3.png',
  '4.png',
  '5.png',
  'amtsgericht.jpg',
  'robots.txt',
  'sitemap.xml',
  'analytics.js',
  'script.js',
  'styles.css'
];

// Kopiere alle Dateien und Verzeichnisse
const allFiles = fs.readdirSync(__dirname);

allFiles.forEach(file => {
  const srcPath = path.join(__dirname, file);
  const destPath = path.join(publicDir, file);
  
  // Überspringe bereits kopierte Verzeichnisse
  if (file === 'public' || file === 'node_modules' || file === '.git') {
    return;
  }
  
  try {
    const stats = fs.statSync(srcPath);
    if (stats.isDirectory()) {
      // Kopiere Verzeichnisse rekursiv
      copyRecursiveSync(srcPath, destPath);
    } else {
      // Kopiere Dateien
      fs.copyFileSync(srcPath, destPath);
    }
  } catch (error) {
    // Ignoriere Fehler beim Kopieren
    console.log(`Skipped ${file}: ${error.message}`);
  }
});

console.log('Build completed successfully!');

