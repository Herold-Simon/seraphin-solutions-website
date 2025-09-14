// Chart Management and Visualization
class ChartManager {
    constructor() {
        this.charts = {};
        this.chartColors = [
            '#667eea', '#764ba2', '#f093fb', '#f5576c',
            '#4facfe', '#00f2fe', '#43e97b', '#38f9d7',
            '#ffecd2', '#fcb69f', '#a8edea', '#fed6e3'
        ];
        this.currentTimeRange = 'month';
    }

    init() {
        this.setupChartContainers();
        this.setupTimeRangeControls();
    }

    setupChartContainers() {
        // Initialize chart containers
        this.chartContainers = {
            line: document.getElementById('lineChart'),
            pie: document.getElementById('pieChart'),
            bar: document.getElementById('barChart')
        };

        // Setup chart toggle buttons
        document.querySelectorAll('.chart-toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const chartType = e.currentTarget.dataset.chart;
                this.toggleChart(chartType);
            });
        });
    }

    setupTimeRangeControls() {
        // Time range buttons
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const range = e.currentTarget.dataset.range;
                this.setTimeRange(range);
            });
        });

        // Custom range apply button
        const applyBtn = document.getElementById('apply-custom-range');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyCustomRange();
            });
        }

        // Set default date range
        this.setDefaultDateRange();
    }

    setTimeRange(range) {
        this.currentTimeRange = range;
        
        // Update active button
        document.querySelectorAll('.time-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-range="${range}"]`).classList.add('active');

        // Reload charts with new time range
        this.loadCharts();
    }

    applyCustomRange() {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        if (!startDate || !endDate) {
            window.authManager.showError('Bitte wählen Sie Start- und Enddatum aus.');
            return;
        }

        if (new Date(startDate) > new Date(endDate)) {
            window.authManager.showError('Das Startdatum muss vor dem Enddatum liegen.');
            return;
        }

        this.currentTimeRange = 'custom';
        this.customStartDate = startDate;
        this.customEndDate = endDate;
        this.loadCharts();
    }

    setDefaultDateRange() {
        const today = new Date();
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        
        document.getElementById('end-date').value = today.toISOString().split('T')[0];
        document.getElementById('start-date').value = lastMonth.toISOString().split('T')[0];
    }

    async loadCharts() {
        try {
            this.showLoading();
            
            // Load all chart data
            const [lineData, pieData, barData] = await Promise.all([
                window.statisticsAPI.getChartData('line', this.currentTimeRange),
                window.statisticsAPI.getChartData('pie', this.currentTimeRange),
                window.statisticsAPI.getChartData('bar', this.currentTimeRange)
            ]);

            // Render charts
            this.renderLineChart(lineData);
            this.renderPieChart(pieData);
            this.renderBarChart(barData);

        } catch (error) {
            window.authManager.showError(window.statisticsAPI.handleError(error, 'Charts'));
        } finally {
            this.hideLoading();
        }
    }

    renderLineChart(data) {
        const ctx = this.chartContainers.line;
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.line) {
            this.charts.line.destroy();
        }

        this.charts.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: data.datasets || []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#667eea',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Zeit'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Aufrufe'
                        },
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    renderPieChart(data) {
        const ctx = this.chartContainers.pie;
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.pie) {
            this.charts.pie.destroy();
        }

        this.charts.pie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.labels || [],
                datasets: [{
                    data: data.values || [],
                    backgroundColor: this.chartColors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            padding: 20,
                            boxWidth: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#667eea',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    renderBarChart(data) {
        const ctx = this.chartContainers.bar;
        if (!ctx) return;

        // Destroy existing chart
        if (this.charts.bar) {
            this.charts.bar.destroy();
        }

        this.charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'Aufrufe',
                    data: data.values || [],
                    backgroundColor: this.chartColors[0],
                    borderColor: this.chartColors[0],
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: '#667eea',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Aufrufe'
                        },
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    y: {
                        display: true,
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    toggleChart(chartType) {
        const chartContainer = document.querySelector(`[data-chart="${chartType}"]`).closest('.chart-container');
        const chartWrapper = chartContainer.querySelector('.chart-wrapper');
        
        if (chartContainer.classList.contains('expanded')) {
            chartContainer.classList.remove('expanded');
            chartWrapper.style.height = '300px';
        } else {
            chartContainer.classList.add('expanded');
            chartWrapper.style.height = '500px';
        }

        // Resize chart
        if (this.charts[chartType]) {
            this.charts[chartType].resize();
        }
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

    // Update statistics overview cards
    updateStatsOverview(stats) {
        const totalVideos = document.getElementById('total-videos');
        const totalViews = document.getElementById('total-views');
        const todayViews = document.getElementById('today-views');
        const mostViewedTitle = document.getElementById('most-viewed-title');

        if (totalVideos) totalVideos.textContent = stats.totalVideos || 0;
        if (totalViews) totalViews.textContent = this.formatNumber(stats.totalViews || 0);
        if (todayViews) todayViews.textContent = this.formatNumber(stats.todayViews || 0);
        if (mostViewedTitle) {
            mostViewedTitle.textContent = stats.mostViewedVideo?.title || '-';
            if (stats.mostViewedVideo?.title && stats.mostViewedVideo.title.length > 20) {
                mostViewedTitle.textContent = stats.mostViewedVideo.title.substring(0, 20) + '...';
            }
        }
    }

    formatNumber(num) {
        return new Intl.NumberFormat('de-DE').format(num);
    }

    // Destroy all charts
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Initialize chart manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chartManager = new ChartManager();
});
