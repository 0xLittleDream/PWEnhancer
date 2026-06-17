// Chart.js Default Configurations for Dark Theme
Chart.defaults.color = '#94a3b8';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 17, 23, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#f8fafc';
Chart.defaults.plugins.tooltip.bodyColor = '#f8fafc';
Chart.defaults.plugins.tooltip.borderColor = '#334155';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.scale.grid.borderColor = 'transparent';

// Global Chart Instances
let todayChart, categoryChart, savedChart;

document.addEventListener('DOMContentLoaded', () => {
    function formatTime(totalSeconds) {
        if (!totalSeconds || isNaN(totalSeconds)) return "0h 0m";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    function renderCharts() {
        chrome.storage.local.get({
            detailedStudyTime: { lectures: 0, notes: 0, dpps: 0 },
            detailedTimeSaved: { customSpeed: 0, jumpcutter: 0 },
            dailyHistory: {},
            hourlyHistory: {},
            dailyCategoryHistory: {},
            dailySavedHistory: {}
        }, (res) => {
            const now = new Date();
            const todayIso = now.toISOString().split('T')[0];

            // 1. Update Grand Totals
            const totalStudy = (res.detailedStudyTime.lectures || 0) + (res.detailedStudyTime.notes || 0) + (res.detailedStudyTime.dpps || 0);
            const totalSaved = (res.detailedTimeSaved.customSpeed || 0) + (res.detailedTimeSaved.jumpcutter || 0);
            document.getElementById('grand-total-saved').textContent = formatTime(totalSaved);
            document.getElementById('stat-total-study').textContent = formatTime(totalStudy);
            document.getElementById('stat-total-saved').textContent = formatTime(totalSaved);

            // 2. Prepare 7-Day Labels
            const last7Days = [];
            const last7Dates = [];
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                last7Days.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
                last7Dates.push(d.toISOString().split('T')[0]);
            }

            // 3. Render Today's Timeline Chart
            const todayHourly = res.hourlyHistory[todayIso] || {};
            const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
            const hourData = Array.from({length: 24}, (_, i) => (todayHourly[i.toString()] || 0) / 60); // in minutes

            if (todayChart) todayChart.destroy();
            todayChart = new Chart(document.getElementById('todayTimelineChart'), {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [{
                        label: 'Study Minutes',
                        data: hourData,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#3b82f6',
                        pointRadius: 0,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, suggestedMax: 60 }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${Math.round(ctx.raw)} mins` } }
                    }
                }
            });

            // 4. Render Category Trend Chart
            const catData = {
                lectures: last7Dates.map(d => ((res.dailyCategoryHistory[d] || {}).lectures || 0) / 3600), // in hours
                dpps: last7Dates.map(d => ((res.dailyCategoryHistory[d] || {}).dpps || 0) / 3600),
                notes: last7Dates.map(d => ((res.dailyCategoryHistory[d] || {}).notes || 0) / 3600)
            };

            if (categoryChart) categoryChart.destroy();
            categoryChart = new Chart(document.getElementById('categoryTrendChart'), {
                type: 'line',
                data: {
                    labels: last7Days,
                    datasets: [
                        { label: 'Lectures', data: catData.lectures, borderColor: '#3b82f6', backgroundColor: '#3b82f6', tension: 0.4 },
                        { label: 'DPPs', data: catData.dpps, borderColor: '#8b5cf6', backgroundColor: '#8b5cf6', tension: 0.4 },
                        { label: 'Notes', data: catData.notes, borderColor: '#10b981', backgroundColor: '#10b981', tension: 0.4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
                    plugins: {
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}h` } }
                    }
                }
            });

            // 5. Render Time Saved Chart
            const savedData = {
                custom: last7Dates.map(d => ((res.dailySavedHistory[d] || {}).customSpeed || 0) / 3600),
                jump: last7Dates.map(d => ((res.dailySavedHistory[d] || {}).jumpcutter || 0) / 3600)
            };

            if (savedChart) savedChart.destroy();
            savedChart = new Chart(document.getElementById('savedTrendChart'), {
                type: 'bar',
                data: {
                    labels: last7Days,
                    datasets: [
                        { label: 'Saved by Custom Speed', data: savedData.custom, backgroundColor: '#f59e0b', borderRadius: 4 },
                        { label: 'Saved by Jumpcutter', data: savedData.jump, backgroundColor: '#ef4444', borderRadius: 4 }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        x: { stacked: true },
                        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Hours Saved' } }
                    },
                    plugins: {
                        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.raw.toFixed(1)}h` } }
                    }
                }
            });

            // 6. Render Heatmap Calendar
            renderHeatmap(res.dailyHistory);
        });
    }

    function renderHeatmap(historyObj) {
        const container = document.getElementById('heatmap-container');
        if (!container) return;
        container.innerHTML = '';

        // Generate last 180 days (approx 6 months) to fit beautifully
        const daysToRender = 180;
        
        // Find max study day to calculate intensity levels
        const values = Object.values(historyObj).filter(v => typeof v === 'number');
        const maxSeconds = values.length > 0 ? Math.max(...values) : 3600;

        // Create grid
        for (let i = daysToRender - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            const seconds = historyObj[iso] || 0;

            // Calculate level 0-4
            let level = 0;
            if (seconds > 0) {
                const ratio = seconds / maxSeconds;
                if (ratio > 0.75) level = 4;
                else if (ratio > 0.5) level = 3;
                else if (ratio > 0.25) level = 2;
                else level = 1;
            }

            const dayDiv = document.createElement('div');
            dayDiv.className = 'heatmap-day';
            dayDiv.setAttribute('data-level', level);
            
            dayDiv.innerHTML = `
                <div class="heatmap-tooltip">
                    ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}<br>
                    ${formatTime(seconds)} studied
                </div>
            `;
            container.appendChild(dayDiv);
        }
    }

    // Initial load
    renderCharts();

    // Re-render when storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            renderCharts();
        }
    });
});
