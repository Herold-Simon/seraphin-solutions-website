// Authentication Management
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    init() {
        // Check if user is already logged in
        this.checkExistingSession();
        this.setupEventListeners();
    }

    checkExistingSession() {
        const token = localStorage.getItem('statistics_token');
        const accountData = localStorage.getItem('statistics_account');
        
        if (token && accountData) {
            try {
                this.currentUser = JSON.parse(accountData);
                window.statisticsAPI.init(this.currentUser.id, null);
                this.showDashboard();
            } catch (error) {
                console.error('Error parsing stored account data:', error);
                this.logout();
            }
        }
    }

    setupEventListeners() {
        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Logout button
        const logoutBtn = document.getElementById('logout-link');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => this.handleLogout(e));
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const loginBtn = event.target.querySelector('button[type="submit"]');
        
        // Validate input
        if (!email || !password) {
            this.showError('Bitte füllen Sie alle Felder aus.');
            return;
        }

        if (!this.isValidEmail(email)) {
            this.showError('Bitte geben Sie eine gültige E-Mail-Adresse ein.');
            return;
        }

        // Show loading state
        this.setLoadingState(loginBtn, true);
        this.hideError();

        try {
            const result = await window.statisticsAPI.login(email, password);
            
            this.currentUser = {
                id: result.accountId,
                name: result.name,
                email: result.email
            };

            this.showSuccess('Erfolgreich angemeldet!');
            this.showDashboard();
            
        } catch (error) {
            this.showError(window.statisticsAPI.handleError(error, 'Login'));
        } finally {
            this.setLoadingState(loginBtn, false);
        }
    }

    handleLogout(event) {
        event.preventDefault();
        
        if (confirm('Möchten Sie sich wirklich abmelden?')) {
            this.logout();
        }
    }

    logout() {
        window.statisticsAPI.logout();
        this.currentUser = null;
        this.showLogin();
        this.showSuccess('Erfolgreich abgemeldet.');
    }

    showDashboard() {
        const loginSection = document.getElementById('login-section');
        const dashboardSection = document.getElementById('dashboard-section');
        const dashboardLink = document.getElementById('dashboard-link');
        const logoutLink = document.getElementById('logout-link');

        if (loginSection) loginSection.style.display = 'none';
        if (dashboardSection) dashboardSection.style.display = 'block';
        if (dashboardLink) dashboardLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'block';

        // Update account name in dashboard
        const accountName = document.getElementById('account-name');
        if (accountName && this.currentUser) {
            accountName.textContent = `Willkommen, ${this.currentUser.name}!`;
        }

        // Initialize dashboard
        if (window.dashboardManager) {
            window.dashboardManager.init();
        }
    }

    showLogin() {
        const loginSection = document.getElementById('login-section');
        const dashboardSection = document.getElementById('dashboard-section');
        const dashboardLink = document.getElementById('dashboard-link');
        const logoutLink = document.getElementById('logout-link');

        if (loginSection) loginSection.style.display = 'block';
        if (dashboardSection) dashboardSection.style.display = 'none';
        if (dashboardLink) dashboardLink.style.display = 'block';
        if (logoutLink) logoutLink.style.display = 'none';

        // Clear form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.reset();
        }
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    setLoadingState(button, loading) {
        if (!button) return;

        if (loading) {
            button.disabled = true;
            button.classList.add('loading');
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Anmeldung...';
        } else {
            button.disabled = false;
            button.classList.remove('loading');
            button.innerHTML = '<i class="fas fa-sign-in-alt"></i> Anmelden';
        }
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        const errorText = document.getElementById('error-text');
        
        if (errorElement && errorText) {
            errorText.textContent = message;
            errorElement.style.display = 'flex';
            
            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.hideError();
            }, 5000);
        }
    }

    hideError() {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
    }

    showSuccess(message) {
        // Create success message element
        const successElement = document.createElement('div');
        successElement.className = 'success-message';
        successElement.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;

        document.body.appendChild(successElement);

        // Auto-remove after 3 seconds
        setTimeout(() => {
            if (successElement.parentNode) {
                successElement.parentNode.removeChild(successElement);
            }
        }, 3000);
    }

    // Check authentication status
    isAuthenticated() {
        return window.statisticsAPI.isAuthenticated();
    }

    // Get current user
    getCurrentUser() {
        return this.currentUser;
    }
}

// Initialize authentication manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});

// Close error message when clicked
document.addEventListener('DOMContentLoaded', () => {
    const closeErrorBtn = document.getElementById('close-error');
    if (closeErrorBtn) {
        closeErrorBtn.addEventListener('click', () => {
            window.authManager.hideError();
        });
    }
});
