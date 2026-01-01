# Google Analytics & Search Console Setup

Diese Anleitung hilft Ihnen dabei, Google Analytics 4 und Google Search Console korrekt einzurichten, damit alle Aufrufe richtig gezählt werden.

## ✅ Was bereits implementiert ist:

1. **Google Analytics 4 Script** (`analytics.js`)
   - Automatisches Page View Tracking
   - Event Tracking für:
     - Formular-Submits
     - Button-Clicks
     - Externe Links
     - Downloads
     - Scroll-Tiefe (25%, 50%, 75%, 100%)
     - Zeit auf Seite
   - DSGVO-konform (IP-Anonymisierung aktiviert)

2. **Analytics auf folgenden Seiten aktiviert:**
   - ✅ index.html
   - ✅ programm.html
   - ✅ weitere-informationen.html
   - ✅ support.html
   - ✅ login.html

3. **Nicht getrackt (bewusst):**
   - ❌ dashboard.html (privater Bereich, noindex)
   - ❌ account.html (privater Bereich)

## 🔧 Google Analytics 4 einrichten:

### Schritt 1: Google Analytics Property prüfen

1. Gehen Sie zu: https://analytics.google.com/
2. Stellen Sie sicher, dass Sie eine **GA4 Property** haben (nicht Universal Analytics)
3. Ihre Measurement ID sollte sein: `G-W5MJXCE4XC`

### Schritt 2: Real-Time Reports prüfen

1. In Google Analytics: **Berichte** → **Echtzeit**
2. Öffnen Sie Ihre Website in einem neuen Tab
3. Sie sollten Ihren Besuch innerhalb weniger Sekunden sehen

### Schritt 3: Enhanced Measurement aktivieren

1. In Google Analytics: **Verwaltung** (⚙️) → **Datenströme**
2. Klicken Sie auf Ihren Web-Datenstrom
3. Scrollen Sie zu **Erweiterte Messung**
4. Aktivieren Sie:
   - ✅ Seitenaufrufe
   - ✅ Scrolls
   - ✅ Outbound-Klicks
   - ✅ Site-Suche
   - ✅ Video-Engagement
   - ✅ Datei-Downloads

### Schritt 4: Conversion Events einrichten (optional)

Für wichtige Aktionen können Sie Conversion Events erstellen:

1. **Verwaltung** → **Ereignisse**
2. Klicken Sie auf **Ereignis erstellen**
3. Wichtige Events, die bereits getrackt werden:
   - `form_submit` - Formular-Submits
   - `contact_form_submit` - Kontaktformular
   - `button_click` - Button-Klicks
   - `download` - Datei-Downloads
   - `scroll_25_percent`, `scroll_50_percent`, etc. - Scroll-Tiefe

## 🔍 Google Search Console einrichten:

### Schritt 1: Website hinzufügen

1. Gehen Sie zu: https://search.google.com/search-console
2. Klicken Sie auf **Eigenschaft hinzufügen**
3. Wählen Sie **URL-Präfix**
4. Geben Sie ein: `https://www.seraphin-solutions.de`
5. Klicken Sie auf **Weiter**

### Schritt 2: Website verifizieren

**Option A: HTML-Tag (empfohlen)**
1. Kopieren Sie den Meta-Tag-Code
2. Öffnen Sie `index.html`
3. Fügen Sie den Code im `<head>`-Bereich ein:
   ```html
   <meta name="google-site-verification" content="IHR_CODE_HIER" />
   ```
4. Committen und deployen Sie die Änderung
5. Klicken Sie in Search Console auf **Verifizieren**

**Option B: HTML-Datei**
1. Laden Sie die HTML-Datei herunter
2. Laden Sie sie im Root-Verzeichnis Ihrer Website hoch
3. Klicken Sie auf **Verifizieren**

### Schritt 3: Sitemap einreichen

1. Nach der Verifizierung: **Sitemaps** → **Neue Sitemap hinzufügen**
2. Geben Sie ein: `sitemap.xml`
3. Klicken Sie auf **Einreichen**

### Schritt 4: URL-Prüfung

1. Gehen Sie zu **URL-Prüfung**
2. Geben Sie eine Ihrer URLs ein (z.B. `https://www.seraphin-solutions.de/`)
3. Klicken Sie auf **URL zur Indizierung anfordern**
4. Wiederholen Sie dies für wichtige Seiten

### Schritt 5: Google Analytics verknüpfen

1. In Search Console: **Einstellungen** → **Verknüpfung**
2. Klicken Sie auf **Google Analytics Property hinzufügen**
3. Wählen Sie Ihre GA4 Property aus
4. Klicken Sie auf **Verknüpfen**

## 📊 Wichtige Reports in Google Analytics:

### 1. Echtzeit-Berichte
- **Berichte** → **Echtzeit**
- Zeigt aktuelle Besucher in Echtzeit

### 2. Lebenszyklus-Berichte
- **Berichte** → **Lebenszyklus** → **Erwerb**
  - Zeigt, woher Ihre Besucher kommen
- **Berichte** → **Lebenszyklus** → **Engagement**
  - Zeigt, wie Besucher mit Ihrer Website interagieren
- **Berichte** → **Lebenszyklus** → **Monetarisierung**
  - Zeigt Conversions und E-Commerce-Daten

### 3. Benutzer-Berichte
- **Berichte** → **Benutzer** → **Technologie**
  - Zeigt Browser, Betriebssysteme, Geräte

## 📈 Wichtige Reports in Google Search Console:

### 1. Leistung
- Zeigt Suchanfragen, Klicks, Impressionen, CTR
- Zeigt, für welche Keywords Sie gefunden werden

### 2. Abdeckung
- Zeigt indexierte Seiten
- Zeigt Fehler und Warnungen

### 3. Erweiterungen
- Zeigt strukturierte Daten
- Zeigt Rich Results

## 🐛 Troubleshooting:

### Problem: Analytics zählt keine Aufrufe

**Lösung:**
1. Prüfen Sie, ob `analytics.js` auf der Seite geladen wird:
   - Browser DevTools → Network → Suchen Sie nach `analytics.js`
2. Prüfen Sie die Browser-Konsole auf Fehler
3. Prüfen Sie, ob Ad-Blocker aktiv ist (deaktivieren Sie ihn zum Testen)
4. Prüfen Sie Real-Time Reports in GA4

### Problem: Search Console zeigt keine Daten

**Lösung:**
1. Warten Sie 24-48 Stunden nach der Verifizierung
2. Prüfen Sie, ob die Sitemap erfolgreich eingereicht wurde
3. Verwenden Sie die URL-Prüfung, um einzelne Seiten zur Indizierung anzufordern

### Problem: Events werden nicht getrackt

**Lösung:**
1. Öffnen Sie Browser DevTools → Console
2. Prüfen Sie, ob `gtag` verfügbar ist: `typeof gtag`
3. Prüfen Sie, ob `trackEvent` verfügbar ist: `typeof trackEvent`
4. Testen Sie manuell: `trackEvent('Test', 'click', 'test_button', null)`

## ✅ Checkliste:

- [ ] Google Analytics 4 Property erstellt
- [ ] Measurement ID `G-W5MJXCE4XC` ist korrekt
- [ ] Real-Time Reports zeigen Besuche
- [ ] Enhanced Measurement aktiviert
- [ ] Google Search Console Account erstellt
- [ ] Website in Search Console verifiziert
- [ ] Sitemap in Search Console eingereicht
- [ ] Google Analytics mit Search Console verknüpft
- [ ] Wichtige URLs zur Indizierung angefordert

## 📝 Zusätzliche Tracking-Optionen:

Falls Sie zusätzliches Tracking benötigen, können Sie in `analytics.js` folgende Funktionen verwenden:

```javascript
// Manuelles Event Tracking
trackEvent('Kategorie', 'Aktion', 'Label', Wert);

// Beispiel: Button-Click tracken
trackEvent('Button', 'click', 'Demo buchen', null);

// Beispiel: Conversion tracken
trackEvent('Conversion', 'demo_requested', 'Kontaktformular', 100);
```

## 🔒 Datenschutz:

- ✅ IP-Anonymisierung ist aktiviert (`anonymize_ip: true`)
- ✅ DSGVO-konforme Cookie-Einstellungen
- ✅ Kein Tracking auf privaten Seiten (dashboard, account)

**Wichtig:** Stellen Sie sicher, dass Ihre Datenschutzerklärung Google Analytics erwähnt!

---

**Hilfe:** Bei Fragen oder Problemen konsultieren Sie die offizielle Google Analytics Dokumentation: https://support.google.com/analytics

