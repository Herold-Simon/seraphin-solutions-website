// Main Application Logic
class App {
    constructor() {
        this.isInitialized = false;
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        document.addEventListener('DOMContentLoaded', () => {
            this.setupGlobalEventListeners();
            this.initializeApp();
            this.isInitialized = true;
        });
    }

    setupGlobalEventListeners() {
        // Handle window resize for responsive charts
        window.addEventListener('resize', this.debounce(() => {
            this.handleResize();
        }, 250));

        // Handle online/offline status
        window.addEventListener('online', () => {
            this.handleOnlineStatus(true);
        });

        window.addEventListener('offline', () => {
            this.handleOnlineStatus(false);
        });

        // Handle page visibility changes
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    initializeApp() {
        console.log('Initializing Gebäudenavi Dashboard...');
        
        // Check if we're in development mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            this.setupDevelopmentMode();
        }

        // Initialize error handling
        this.setupErrorHandling();

        // Check for updates
        this.checkForUpdates();

        console.log('Dashboard initialized successfully');
    }

    setupDevelopmentMode() {
        console.log('Development mode detected');
        
        // Add development indicators
        document.body.classList.add('development-mode');
        
        // Log API calls in development
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
            console.log('API Call:', args[0], args[1]);
            return originalFetch.apply(this, args);
        };
    }

    setupErrorHandling() {
        // Global error handler
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.showErrorNotification('Ein unerwarteter Fehler ist aufgetreten.');
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.showErrorNotification('Ein Fehler beim Laden der Daten ist aufgetreten.');
        });
    }

    handleResize() {
        // Resize charts when window is resized
        if (window.chartManager) {
            Object.values(window.chartManager.charts).forEach(chart => {
                if (chart && chart.resize) {
                    chart.resize();
                }
            });
        }

        // Handle responsive layout changes
        this.handleResponsiveLayout();
    }

    handleResponsiveLayout() {
        const isMobile = window.innerWidth <= 768;
        document.body.classList.toggle('mobile-view', isMobile);

        // Adjust chart containers for mobile
        if (window.chartManager) {
            const chartContainers = document.querySelectorAll('.chart-wrapper');
            chartContainers.forEach(container => {
                if (isMobile) {
                    container.style.height = '250px';
                } else {
                    container.style.height = '300px';
                }
            });
        }
    }

    handleOnlineStatus(isOnline) {
        const statusIndicator = this.getOrCreateStatusIndicator();
        
        if (isOnline) {
            statusIndicator.className = 'status-indicator online';
            statusIndicator.textContent = 'Online';
            statusIndicator.style.display = 'block';
            
            // Auto-hide after 3 seconds
            setTimeout(() => {
                statusIndicator.style.display = 'none';
            }, 3000);

            // Refresh data if user is authenticated
            if (window.authManager && window.authManager.isAuthenticated()) {
                if (window.dashboardManager) {
                    window.dashboardManager.refreshData();
                }
            }
        } else {
            statusIndicator.className = 'status-indicator offline';
            statusIndicator.textContent = 'Offline';
            statusIndicator.style.display = 'block';
        }
    }

    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, pause updates
            this.pauseUpdates();
        } else {
            // Page is visible, resume updates
            this.resumeUpdates();
        }
    }

    handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + R: Refresh data
        if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
            event.preventDefault();
            if (window.dashboardManager && window.authManager.isAuthenticated()) {
                window.dashboardManager.refreshData();
            }
        }

        // Escape: Close modals/overlays
        if (event.key === 'Escape') {
            this.closeAllModals();
        }

        // Ctrl/Cmd + /: Show keyboard shortcuts help
        if ((event.ctrlKey || event.metaKey) && event.key === '/') {
            event.preventDefault();
            this.showKeyboardShortcuts();
        }
    }

    pauseUpdates() {
        // Pause any ongoing updates or timers
        console.log('Pausing updates - page hidden');
    }

    resumeUpdates() {
        // Resume updates when page becomes visible
        console.log('Resuming updates - page visible');
        
        // Refresh data if needed
        if (window.authManager && window.authManager.isAuthenticated()) {
            const lastUpdate = localStorage.getItem('lastDashboardUpdate');
            const now = Date.now();
            
            // Refresh if last update was more than 5 minutes ago
            if (!lastUpdate || (now - parseInt(lastUpdate)) > 300000) {
                if (window.dashboardManager) {
                    window.dashboardManager.refreshData();
                }
            }
        }
    }

    getOrCreateStatusIndicator() {
        let indicator = document.getElementById('status-indicator');
        
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'status-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 80px;
                right: 20px;
                padding: 8px 16px;
                border-radius: 4px;
                color: white;
                font-weight: 500;
                z-index: 2000;
                display: none;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(indicator);
        }
        
        return indicator;
    }

    showErrorNotification(message) {
        if (window.authManager) {
            window.authManager.showError(message);
        } else {
            // Fallback error display
            const errorDiv = document.createElement('div');
            errorDiv.className = 'error-message';
            errorDiv.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i>
                <span>${message}</span>
            `;
            document.body.appendChild(errorDiv);
            
            setTimeout(() => {
                if (errorDiv.parentNode) {
                    errorDiv.parentNode.removeChild(errorDiv);
                }
            }, 5000);
        }
    }

    closeAllModals() {
        // Close any open modals or overlays
        const modals = document.querySelectorAll('.modal-overlay, .loading-overlay');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
    }

    showKeyboardShortcuts() {
        const shortcuts = [
            { key: 'Ctrl/Cmd + R', description: 'Daten aktualisieren' },
            { key: 'Escape', description: 'Modals schließen' },
            { key: 'Ctrl/Cmd + /', description: 'Tastenkürzel anzeigen' }
        ];

        const shortcutsHtml = shortcuts.map(shortcut => 
            `<div class="shortcut-item">
                <kbd>${shortcut.key}</kbd>
                <span>${shortcut.description}</span>
            </div>`
        ).join('');

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                <h3>Tastenkürzel</h3>
                <div class="shortcuts-list">
                    ${shortcutsHtml}
                </div>
                <button onclick="this.closest('.modal-overlay').remove()">Schließen</button>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    async checkForUpdates() {
        try {
            // Check if there's a new version available
            const response = await fetch('/version.json?' + Date.now());
            if (response.ok) {
                const versionData = await response.json();
                const currentVersion = localStorage.getItem('app-version');
                
                if (!currentVersion || currentVersion !== versionData.version) {
                    this.showUpdateNotification();
                    localStorage.setItem('app-version', versionData.version);
                }
            }
        } catch (error) {
            // Silently fail - version checking is not critical
            console.log('Version check failed:', error);
        }
    }

    showUpdateNotification() {
        const notification = document.createElement('div');
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <i class="fas fa-sync-alt"></i>
                <span>Neue Version verfügbar</span>
                <button onclick="window.location.reload()">Aktualisieren</button>
                <button onclick="this.closest('.update-notification').remove()">&times;</button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 10000);
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Public API methods
    getVersion() {
        return '1.0.0';
    }

    getStatus() {
        return {
            initialized: this.isInitialized,
            online: navigator.onLine,
            authenticated: window.authManager ? window.authManager.isAuthenticated() : false
        };
    }
}

// Initialize the main application
window.app = new App();

// Add some global CSS for development mode and notifications
const style = document.createElement('style');
style.textContent = `
    .development-mode::before {
        content: 'DEV';
        position: fixed;
        top: 0;
        left: 0;
        background: #ff4757;
        color: white;
        padding: 2px 8px;
        font-size: 10px;
        font-weight: bold;
        z-index: 9999;
    }
    
    .status-indicator.online {
        background: #2ed573;
    }
    
    .status-indicator.offline {
        background: #ff4757;
    }
    
    .update-notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #3742fa;
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(55, 66, 250, 0.3);
        z-index: 2000;
        animation: slideIn 0.3s ease-out;
    }
    
    .update-content {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    .update-content button {
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8rem;
    }
    
    .update-content button:hover {
        background: rgba(255, 255, 255, 0.3);
    }
    
    .shortcuts-list {
        margin: 20px 0;
    }
    
    .shortcut-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid #eee;
    }
    
    .shortcut-item kbd {
        background: #f8f9fa;
        border: 1px solid #dee2e6;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 0.8rem;
        font-family: monospace;
    }
    
    .mobile-view .chart-wrapper {
        height: 250px !important;
    }
    
    @media (max-width: 768px) {
        .update-notification {
            bottom: 10px;
            right: 10px;
            left: 10px;
        }
    }
`;
document.head.appendChild(style);
