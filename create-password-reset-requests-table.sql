-- Erstelle Tabelle für Passwort-Reset-Requests
CREATE TABLE IF NOT EXISTS password_reset_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'expired', 'used'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confirmed_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE
);

-- Index für bessere Performance
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_username ON password_reset_requests(username);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status);
CREATE INDEX IF NOT EXISTS idx_password_reset_requests_expires_at ON password_reset_requests(expires_at);

-- Kommentare für Dokumentation
COMMENT ON TABLE password_reset_requests IS 'Speichert Passwort-Reset-Anfragen von Benutzern';
COMMENT ON COLUMN password_reset_requests.username IS 'Benutzername des anfragenden Benutzers';
COMMENT ON COLUMN password_reset_requests.status IS 'Status der Anfrage: pending, confirmed, expired, used';
COMMENT ON COLUMN password_reset_requests.created_at IS 'Zeitpunkt der Anfrage';
COMMENT ON COLUMN password_reset_requests.confirmed_at IS 'Zeitpunkt der Bestätigung durch Admin';
COMMENT ON COLUMN password_reset_requests.expires_at IS 'Ablaufzeit der Anfrage (normalerweise 30 Minuten)';
COMMENT ON COLUMN password_reset_requests.used_at IS 'Zeitpunkt der Nutzung (Passwort wurde geändert)';
