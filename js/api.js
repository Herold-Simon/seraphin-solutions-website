// API Configuration and Functions
class StatisticsAPI {
    constructor() {
        this.baseURL = 'https://seraphin-solutions.de/api'; // API direkt auf der Website
        this.apiKey = null;
        this.accountId = null;
        this.token = null;
    }

    // Initialize API with credentials
    init(accountId, apiKey) {
        this.accountId = accountId;
        this.apiKey = apiKey;
        this.token = localStorage.getItem('statistics_token');
    }

    // Authentication
    async login(email, password) {
        try {
            const response = await fetch(`${this.baseURL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) {
                throw new Error('Login fehlgeschlagen');
            }

            const data = await response.json();
            this.token = data.token;
            this.accountId = data.accountId;
            
            localStorage.setItem('statistics_token', this.token);
            localStorage.setItem('statistics_account', JSON.stringify({
                id: data.accountId,
                name: data.name,
                email: data.email
            }));

            return data;
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    // Get statistics data
    async getStatistics(timeRange = 'month') {
        try {
            const response = await fetch(`${this.baseURL}/statistics/${this.accountId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                params: new URLSearchParams({ timeRange })
            });

            if (!response.ok) {
                throw new Error('Fehler beim Laden der Statistiken');
            }

            return await response.json();
        } catch (error) {
            console.error('Statistics fetch error:', error);
            throw error;
        }
    }

    // Get video data
    async getVideos() {
        try {
            const response = await fetch(`${this.baseURL}/videos/${this.accountId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Fehler beim Laden der Videos');
            }

            return await response.json();
        } catch (error) {
            console.error('Videos fetch error:', error);
            throw error;
        }
    }

    // Get chart data for specific chart type
    async getChartData(chartType, timeRange = 'month') {
        try {
            const response = await fetch(`${this.baseURL}/charts/${this.accountId}/${chartType}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                params: new URLSearchParams({ timeRange })
            });

            if (!response.ok) {
                throw new Error(`Fehler beim Laden der ${chartType} Daten`);
            }

            return await response.json();
        } catch (error) {
            console.error(`${chartType} chart fetch error:`, error);
            throw error;
        }
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && !!this.accountId;
    }

    // Logout
    logout() {
        this.token = null;
        this.accountId = null;
        localStorage.removeItem('statistics_token');
        localStorage.removeItem('statistics_account');
    }

    // Create account (called from AdminPanel)
    async createAccount(accountData) {
        try {
            const response = await fetch(`${this.baseURL}/auth/create-account`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Key': accountData.adminKey
                },
                body: JSON.stringify({
                    name: accountData.name,
                    email: accountData.email,
                    password: accountData.password,
                    statistics: accountData.statistics,
                    videos: accountData.videos
                })
            });

            if (!response.ok) {
                throw new Error('Konto konnte nicht erstellt werden');
            }

            return await response.json();
        } catch (error) {
            console.error('Account creation error:', error);
            throw error;
        }
    }

    // Update statistics (called from AdminPanel)
    async updateStatistics(statisticsData) {
        try {
            const response = await fetch(`${this.baseURL}/statistics/${this.accountId}/update`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(statisticsData)
            });

            if (!response.ok) {
                throw new Error('Statistiken konnten nicht aktualisiert werden');
            }

            return await response.json();
        } catch (error) {
            console.error('Statistics update error:', error);
            throw error;
        }
    }

    // Get account info
    async getAccountInfo() {
        try {
            const response = await fetch(`${this.baseURL}/account/${this.accountId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!response.ok) {
                throw new Error('Fehler beim Laden der Kontoinformationen');
            }

            return await response.json();
        } catch (error) {
            console.error('Account info fetch error:', error);
            throw error;
        }
    }

    // Helper method to format date ranges
    getDateRange(timeRange) {
        const now = new Date();
        let start, end;

        switch (timeRange) {
            case 'week':
                start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                end = now;
                break;
            case 'month':
                start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                end = now;
                break;
            case 'quarter':
                start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
                end = now;
                break;
            case 'year':
                start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
                end = now;
                break;
            case 'all':
                start = new Date(0); // Beginning of time
                end = now;
                break;
            default:
                start = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
                end = now;
        }

        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0]
        };
    }

    // Helper method to handle errors consistently
    handleError(error, context = '') {
        console.error(`API Error ${context}:`, error);
        
        if (error.message.includes('401') || error.message.includes('Unauthorized')) {
            this.logout();
            window.location.reload();
            return 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.';
        }
        
        if (error.message.includes('404')) {
            return 'Die angeforderte Ressource wurde nicht gefunden.';
        }
        
        if (error.message.includes('500')) {
            return 'Serverfehler. Bitte versuchen Sie es später erneut.';
        }
        
        return error.message || 'Ein unbekannter Fehler ist aufgetreten.';
    }
}

// Create global API instance
window.statisticsAPI = new StatisticsAPI();
