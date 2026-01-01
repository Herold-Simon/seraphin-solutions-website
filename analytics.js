// Google Analytics 4 (GA4) Tracking Script
// Zentrales Script für alle Seiten
// Entspricht dem offiziellen Google Tag Code

// Google tag (gtag.js)
(function() {
    'use strict';
    
    // Google Analytics Measurement ID
    const GA_MEASUREMENT_ID = 'G-EDTVDY6L6F';
    
    // Initialisiere dataLayer und gtag-Funktion (exakt wie im offiziellen Code)
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    
    // Globale gtag-Funktion verfügbar machen
    window.gtag = gtag;
    
    // Konfiguriere GA4 (mit DSGVO-konformen Einstellungen)
    gtag('config', GA_MEASUREMENT_ID, {
        'anonymize_ip': true, // DSGVO-konform
        'cookie_flags': 'SameSite=None;Secure'
    });
    
    // Lade Google Analytics Script (exakt wie im offiziellen Code)
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_MEASUREMENT_ID;
    document.head.appendChild(script);
    
    // Page View Tracking für Single Page Applications (falls nötig)
    if (window.history && window.history.pushState) {
        const originalPushState = window.history.pushState;
        window.history.pushState = function() {
            originalPushState.apply(window.history, arguments);
            gtag('config', GA_MEASUREMENT_ID, {
                'page_path': window.location.pathname + window.location.search,
                'page_title': document.title,
                'page_location': window.location.href
            });
        };
    }
    
    // Event Tracking Helper-Funktionen
    window.trackEvent = function(category, action, label, value) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                'event_category': category,
                'event_label': label,
                'value': value,
                'non_interaction': false
            });
        }
    };
    
    // Formular-Submit Tracking
    document.addEventListener('DOMContentLoaded', function() {
        // Track alle Formular-Submits
        const forms = document.querySelectorAll('form');
        forms.forEach(function(form) {
            form.addEventListener('submit', function(e) {
                const formId = form.id || form.name || 'unknown_form';
                const formAction = form.action || 'submit';
                
                trackEvent('Form', 'submit', formId, null);
                
                // Spezifisches Tracking für Kontaktformular
                if (formId === 'contactForm' || form.querySelector('input[type="email"]')) {
                    trackEvent('Contact', 'form_submit', formId, null);
                }
            });
        });
        
        // Track externe Links
        const externalLinks = document.querySelectorAll('a[href^="http"]:not([href*="' + window.location.hostname + '"])');
        externalLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                trackEvent('Outbound', 'click', this.href, null);
            });
        });
        
        // Track Download-Links
        const downloadLinks = document.querySelectorAll('a[download], a[href$=".pdf"], a[href$=".zip"], a[href$=".doc"], a[href$=".docx"]');
        downloadLinks.forEach(function(link) {
            link.addEventListener('click', function() {
                const fileName = this.download || this.href.split('/').pop();
                trackEvent('Download', 'file', fileName, null);
            });
        });
        
        // Track Button-Clicks (wichtige CTAs)
        const ctaButtons = document.querySelectorAll('.btn-primary, .btn-secondary, [class*="cta"], button[type="submit"]');
        ctaButtons.forEach(function(button) {
            button.addEventListener('click', function() {
                const buttonText = this.textContent.trim() || this.getAttribute('aria-label') || 'unknown_button';
                trackEvent('Button', 'click', buttonText, null);
            });
        });
        
        // Track Video-Views (falls vorhanden)
        const videos = document.querySelectorAll('video');
        videos.forEach(function(video) {
            video.addEventListener('play', function() {
                trackEvent('Video', 'play', this.src || 'unknown_video', null);
            });
            video.addEventListener('ended', function() {
                trackEvent('Video', 'complete', this.src || 'unknown_video', null);
            });
        });
        
        // Track Scroll-Tiefe (25%, 50%, 75%, 100%)
        let scrollTracked = {
            '25': false,
            '50': false,
            '75': false,
            '100': false
        };
        
        window.addEventListener('scroll', function() {
            const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
            
            if (scrollPercent >= 25 && !scrollTracked['25']) {
                trackEvent('Scroll', '25_percent', window.location.pathname, null);
                scrollTracked['25'] = true;
            }
            if (scrollPercent >= 50 && !scrollTracked['50']) {
                trackEvent('Scroll', '50_percent', window.location.pathname, null);
                scrollTracked['50'] = true;
            }
            if (scrollPercent >= 75 && !scrollTracked['75']) {
                trackEvent('Scroll', '75_percent', window.location.pathname, null);
                scrollTracked['75'] = true;
            }
            if (scrollPercent >= 100 && !scrollTracked['100']) {
                trackEvent('Scroll', '100_percent', window.location.pathname, null);
                scrollTracked['100'] = true;
            }
        });
        
        // Track Zeit auf Seite (nach 30 Sekunden)
        setTimeout(function() {
            trackEvent('Engagement', 'time_on_page', window.location.pathname, 30);
        }, 30000);
    });
})();

