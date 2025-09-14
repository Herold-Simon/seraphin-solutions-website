# Gebäudenavi Website Integration

Diese Dokumentation beschreibt die Integration zwischen der Gebäudenavi-App und der Seraphin Solutions Website für Live-Statistiken.

## Übersicht

Die Integration ermöglicht es Benutzern:
1. Ein Konto in der App zu erstellen
2. Sich auf der Website anzumelden
3. Live-Statistiken ihrer Gebäudenavi-Installation zu sehen

## Funktionsweise

### 1. Account-Erstellung in der App

- Benutzer gehen zum Adminpanel → Datenverwaltung
- Sie geben einen Benutzernamen ein und klicken auf "Konto erstellen"
- Die App sendet die aktuellen Statistiken an die Website
- Die Website erstellt ein Konto mit den übermittelten Daten

### 2. Login auf der Website

- Benutzer besuchen `seraphin-solutions.de/login.html`
- Sie loggen sich mit ihrem Benutzernamen und Admin-Passwort ein
- Nach erfolgreichem Login werden sie zur Statistiken-Seite weitergeleitet

### 3. Live-Synchronisation

- Die App sendet alle 5 Minuten aktuelle Statistiken an die Website
- Die Website zeigt diese Daten in Echtzeit an
- Charts und Grafiken werden automatisch aktualisiert

## API-Endpunkte

### Authentication
- `POST /api/auth/login` - Benutzer anmelden
- `GET /api/auth/verify` - Token verifizieren

### Account Management
- `POST /api/accounts/create` - Neues Konto erstellen

### Statistics
- `GET /api/statistics/get` - Statistiken abrufen
- `POST /api/statistics/update` - Statistiken aktualisieren

### Health Check
- `GET /api/health` - API-Status prüfen

## Datenstruktur

### Statistiken-Objekt
```json
{
  "deviceId": "string",
  "username": "string",
  "statistics": {
    "videos": [
      {
        "id": "string",
        "title": "string",
        "views": "number",
        "lastViewed": "number"
      }
    ],
    "floors": [
      {
        "id": "string",
        "name": "string",
        "rooms": "number"
      }
    ],
    "timeRangeStart": "number",
    "timeRangeEnd": "number",
    "pieChartVideoCount": "number",
    "lineChartVideoCount": "number",
    "barChartVideoCount": "number",
    "lineRaceVideoCount": "number"
  },
  "timestamp": "string"
}
```

## Sicherheit

- Alle API-Aufrufe verwenden HTTPS
- Token-basierte Authentifizierung
- Passwörter werden gehasht gespeichert (in Produktion)
- CORS-Header sind konfiguriert

## Deployment

### Website (Vercel)
1. Alle Dateien in das Vercel-Projekt hochladen
2. `vercel.json` konfiguriert die API-Routen
3. Node.js 18.x Runtime für API-Funktionen

### App
1. `WebsiteIntegrationService` wird automatisch geladen
2. Keine zusätzliche Konfiguration erforderlich
3. Funktioniert mit bestehender Adminpanel-Infrastruktur

## Fehlerbehandlung

- Netzwerkfehler werden abgefangen und angezeigt
- Token-Ablauf wird automatisch erkannt
- Offline-Modus wird angezeigt wenn keine Verbindung
- Retry-Mechanismus für fehlgeschlagene Synchronisationen

## Entwicklung

### Lokale Entwicklung
```bash
# Website lokal testen
cd "Seraphin Solutions Website"
npx vercel dev

# App lokal testen
npm run dev
```

### Produktions-Deployment
1. Website: `vercel --prod`
2. App: Build und Deployment wie gewohnt

## Monitoring

- API-Aufrufe werden in der Konsole protokolliert
- Fehler werden in der Browser-Konsole angezeigt
- Health-Check Endpoint für Überwachung

## Support

Bei Problemen:
1. Browser-Konsole auf Fehler prüfen
2. Netzwerk-Tab für API-Aufrufe prüfen
3. Health-Check Endpoint testen
4. Vercel-Logs prüfen
