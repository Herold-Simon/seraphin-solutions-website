// Dashboard Management
class DashboardManager {
    constructor() {
        this.videos = [];
        this.statistics = null;
        this.currentTimeRange = 'month';
        this.searchQuery = '';
    }

    async init() {
        if (!window.statisticsAPI.isAuthenticated()) {
            return;
        }

        this.setupEventListeners();
        await this.loadDashboardData();
    }

    setupEventListeners() {
        // Refresh button
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }

        // Video search
        const searchInput = document.getElementById('video-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.filterVideos();
            });
        }

        // Chart manager integration
        if (window.chartManager) {
            window.chartManager.currentTimeRange = this.currentTimeRange;
        }
    }

    async loadDashboardData() {
        try {
            this.showLoading();
            
            // Load statistics and videos in parallel
            const [statistics, videos] = await Promise.all([
                window.statisticsAPI.getStatistics(this.currentTimeRange),
                window.statisticsAPI.getVideos()
            ]);

            this.statistics = statistics;
            this.videos = videos;

            // Update UI
            this.updateStatisticsOverview();
            this.renderVideoTable();
            
            // Load charts
            if (window.chartManager) {
                await window.chartManager.loadCharts();
            }

        } catch (error) {
            window.authManager.showError(window.statisticsAPI.handleError(error, 'Dashboard'));
        } finally {
            this.hideLoading();
        }
    }

    updateStatisticsOverview() {
        if (!this.statistics) return;

        // Update stats cards
        if (window.chartManager) {
            window.chartManager.updateStatsOverview(this.statistics);
        }

        // Update time range info
        this.updateTimeRangeInfo();
    }

    updateTimeRangeInfo() {
        const timeRangeInfo = document.querySelector('.time-range-info');
        if (timeRangeInfo && this.statistics) {
            const info = this.statistics.timeRangeInfo || {};
            timeRangeInfo.innerHTML = `
                <p>Zeitraum: ${this.formatDateRange(info.start, info.end)}</p>
                <p>Videos mit Aufrufen: ${info.videosWithViews || 0}</p>
                <p>Gesamte Aufrufe: ${this.formatNumber(info.totalViews || 0)}</p>
            `;
        }
    }

    renderVideoTable() {
        const tbody = document.getElementById('video-table-body');
        if (!tbody) return;

        const filteredVideos = this.getFilteredVideos();
        
        if (filteredVideos.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center" style="padding: 40px; color: #666;">
                        ${this.searchQuery ? 'Keine Videos gefunden' : 'Keine Videos vorhanden'}
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = filteredVideos.map(video => `
            <tr>
                <td class="video-title" title="${this.escapeHtml(video.title)}">
                    ${this.escapeHtml(video.title)}
                </td>
                <td class="views-count">
                    ${this.formatNumber(video.views || 0)}
                </td>
                <td class="date-cell">
                    ${video.lastViewed ? this.formatDate(video.lastViewed) : '-'}
                </td>
                <td class="date-cell">
                    ${this.formatDate(video.createdAt)}
                </td>
            </tr>
        `).join('');
    }

    getFilteredVideos() {
        if (!this.searchQuery) {
            return this.videos.sort((a, b) => (b.views || 0) - (a.views || 0));
        }

        return this.videos
            .filter(video => 
                video.title.toLowerCase().includes(this.searchQuery) ||
                (video.subtitle && video.subtitle.toLowerCase().includes(this.searchQuery)) ||
                (video.keywords && video.keywords.some(keyword => 
                    keyword.toLowerCase().includes(this.searchQuery)
                ))
            )
            .sort((a, b) => (b.views || 0) - (a.views || 0));
    }

    filterVideos() {
        this.renderVideoTable();
    }

    async refreshData() {
        const refreshBtn = document.getElementById('refresh-btn');
        if (refreshBtn) {
            refreshBtn.disabled = true;
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Aktualisieren';
        }

        try {
            await this.loadDashboardData();
            window.authManager.showSuccess('Daten erfolgreich aktualisiert');
        } catch (error) {
            window.authManager.showError(window.statisticsAPI.handleError(error, 'Refresh'));
        } finally {
            if (refreshBtn) {
                refreshBtn.disabled = false;
                refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Aktualisieren';
            }
        }
    }

    formatDate(timestamp) {
        if (!timestamp) return '-';
        
        const date = new Date(timestamp);
        return date.toLocaleDateString('de-DE', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    }

    formatDateRange(start, end) {
        if (!start || !end) return '-';
        
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        return `${startDate.toLocaleDateString('de-DE')} - ${endDate.toLocaleDateString('de-DE')}`;
    }

    formatNumber(num) {
        return new Intl.NumberFormat('de-DE').format(num);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // Export functions
    async exportData(format = 'json') {
        try {
            if (!this.statistics || !this.videos) {
                throw new Error('Keine Daten zum Exportieren verfügbar');
            }

            const exportData = {
                statistics: this.statistics,
                videos: this.videos,
                exportDate: new Date().toISOString(),
                timeRange: this.currentTimeRange
            };

            if (format === 'json') {
                this.downloadJSON(exportData, 'statistics-export.json');
            } else if (format === 'csv') {
                this.downloadCSV(exportData, 'statistics-export.csv');
            }

        } catch (error) {
            window.authManager.showError(`Export fehlgeschlagen: ${error.message}`);
        }
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    downloadCSV(data, filename) {
        const csvContent = this.convertToCSV(data);
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    convertToCSV(data) {
        const headers = ['Video Titel', 'Aufrufe', 'Letzter Aufruf', 'Erstellt'];
        const rows = data.videos.map(video => [
            video.title,
            video.views || 0,
            video.lastViewed ? this.formatDate(video.lastViewed) : '-',
            this.formatDate(video.createdAt)
        ]);

        return [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
    }
}

// Initialize dashboard manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});
