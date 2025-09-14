# Gebäudenavi - Statistiken Dashboard

Ein Web-Dashboard für die Anzeige von Video-Statistiken aus der Gebäudenavi-App.

## Features

- 🔐 **Sicheres Login-System** mit Account-Management
- 📊 **Interaktive Statistiken** mit verschiedenen Diagrammtypen
- 📱 **Responsive Design** für alle Geräte
- 🔄 **Real-time Updates** der Daten
- 📈 **Zeitraum-Filter** für flexible Datenanalyse
- 📋 **Video-Übersicht** mit Suchfunktion
- 💾 **Export-Funktionen** (JSON, CSV)
- ⌨️ **Tastenkürzel** für bessere Benutzerfreundlichkeit

## Installation

1. **Dateien hochladen**: Alle Dateien auf deine Website (seraphin-solutions.de) hochladen
2. **API-Endpunkt konfigurieren**: Die API-URL in `js/api.js` anpassen
3. **SSL-Zertifikat**: HTTPS für sichere API-Kommunikation sicherstellen

## Konfiguration

### API-Konfiguration

Bearbeite die Datei `js/api.js` und passe die API-URL an:

```javascript
this.baseURL = 'https://api.seraphin-solutions.de'; // Deine API-URL
```

### AdminPanel-Integration

Das AdminPanel muss erweitert werden, um Konten zu erstellen und Statistiken zu synchronisieren.

## Verwendung

### Für Benutzer

1. **Anmeldung**: Mit den im AdminPanel erstellten Anmeldedaten einloggen
2. **Dashboard erkunden**: Statistiken, Diagramme und Video-Listen anzeigen
3. **Zeitraum wählen**: Verschiedene Zeiträume für die Datenanalyse auswählen
4. **Daten exportieren**: Statistiken als JSON oder CSV herunterladen

### Für Administratoren

1. **Konto erstellen**: Im AdminPanel ein neues Website-Konto erstellen
2. **Statistiken synchronisieren**: Daten automatisch auf die Website übertragen
3. **Benutzer verwalten**: Zugriff auf verschiedene Konten verwalten

## Dateistruktur

```
website/
├── dashboard.html          # Hauptseite (Dashboard)
├── styles/
│   ├── main.css           # Basis-Styles
│   ├── login.css          # Login-Formular
│   └── dashboard.css      # Dashboard-Layout
├── js/
│   ├── api.js             # API-Kommunikation
│   ├── auth.js            # Authentifizierung
│   ├── charts.js          # Diagramme
│   ├── dashboard.js       # Dashboard-Logik
│   └── main.js            # Hauptanwendung
├── version.json           # Versionsinformationen
└── README.md             # Diese Datei
```

## API-Endpunkte

Das Dashboard erwartet folgende API-Endpunkte:

- `POST /auth/login` - Benutzeranmeldung
- `POST /auth/create-account` - Konto erstellen (AdminPanel)
- `GET /statistics/{accountId}` - Statistiken abrufen
- `GET /videos/{accountId}` - Video-Daten abrufen
- `GET /charts/{accountId}/{type}` - Diagramm-Daten abrufen
- `GET /account/{accountId}` - Kontoinformationen abrufen

## Sicherheit

- 🔒 **HTTPS erforderlich** für alle API-Kommunikation
- 🔑 **Token-basierte Authentifizierung** für sicheren Zugriff
- 🛡️ **Input-Validierung** gegen XSS und andere Angriffe
- 🔐 **Session-Management** mit automatischer Abmeldung

## Browser-Unterstützung

- ✅ Chrome 70+
- ✅ Firefox 65+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Mobile Browser (iOS Safari, Chrome Mobile)

## Entwicklung

### Lokale Entwicklung

1. **HTTP-Server starten**:
   ```bash
   python -m http.server 8000
   # oder
   npx serve .
   ```

2. **Browser öffnen**: `http://localhost:8000/dashboard.html`

### Debugging

- **Entwicklertools**: F12 für Browser-Entwicklertools
- **Console-Logs**: Alle API-Aufrufe werden protokolliert
- **Network-Tab**: API-Anfragen überwachen

## Fehlerbehebung

### Häufige Probleme

1. **"API nicht erreichbar"**
   - API-URL in `api.js` überprüfen
   - HTTPS-Verbindung sicherstellen
   - CORS-Einstellungen prüfen

2. **"Login fehlgeschlagen"**
   - Anmeldedaten überprüfen
   - Account im AdminPanel erstellen
   - API-Endpunkt testen

3. **"Charts werden nicht angezeigt"**
   - Chart.js Bibliothek laden
   - Browser-Kompatibilität prüfen
   - JavaScript-Fehler in Konsole überprüfen

### Support

Bei Problemen oder Fragen:
- 📧 E-Mail: support@seraphin-solutions.de
- 📱 GitHub Issues: Repository-URL
- 📖 Dokumentation: Diese README-Datei

## Lizenz

© 2024 Seraphin Solutions. Alle Rechte vorbehalten.

## Changelog

### Version 1.0.0
- Initiale Veröffentlichung
- Login-System implementiert
- Dashboard mit Statistiken
- Responsive Design
- Export-Funktionen
- Tastenkürzel
- Offline-Unterstützung
