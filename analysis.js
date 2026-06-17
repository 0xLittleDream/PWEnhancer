document.addEventListener('DOMContentLoaded', () => {
    
    function formatTime(totalSeconds) {
        if (!totalSeconds || isNaN(totalSeconds)) return "0h 0m";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        
        if (h > 0) {
            return `${h}h ${m}m`;
        }
        return `${m}m`;
    }

    function updateGraphs() {
        chrome.storage.local.get({
            detailedStudyTime: { lectures: 0, notes: 0, dpps: 0 },
            detailedTimeSaved: { customSpeed: 0, jumpcutter: 0 },
            dailyHistory: {}
        }, (res) => {
            const study = res.detailedStudyTime;
            const saved = res.detailedTimeSaved;
            const history = res.dailyHistory;

            // Calculate total active time
            const totalStudy = (study.lectures || 0) + (study.notes || 0) + (study.dpps || 0);
            
            // Calculate total time saved
            const totalSaved = (saved.customSpeed || 0) + (saved.jumpcutter || 0);

            // Update Grand Totals
            document.getElementById('grand-total-saved').textContent = formatTime(totalSaved);
            document.getElementById('stat-total-study').textContent = formatTime(totalStudy);
            document.getElementById('stat-total-saved').textContent = formatTime(totalSaved);

            // --- Study Time Distribution Graph ---
            const updateBar = (id, value, total) => {
                const barEl = document.getElementById(`bar-${id}`);
                const valEl = document.getElementById(`val-${id}`);
                
                if (barEl && valEl) {
                    valEl.textContent = formatTime(value);
                    const percentage = total > 0 ? (value / total) * 100 : 0;
                    barEl.style.width = (value > 0 && percentage < 2) ? '2%' : `${percentage}%`;
                }
            };

            updateBar('lectures', study.lectures || 0, totalStudy);
            updateBar('dpps', study.dpps || 0, totalStudy);
            updateBar('notes', study.notes || 0, totalStudy);

            // Combined Stacked Bar (Study)
            if (totalStudy > 0) {
                document.getElementById('bar-comb-lectures').style.width = `${((study.lectures || 0) / totalStudy) * 100}%`;
                document.getElementById('bar-comb-dpps').style.width = `${((study.dpps || 0) / totalStudy) * 100}%`;
                document.getElementById('bar-comb-notes').style.width = `${((study.notes || 0) / totalStudy) * 100}%`;
            }

            // --- Time Saved Analytics Graph ---
            updateBar('speed', saved.customSpeed || 0, totalSaved);
            updateBar('jump', saved.jumpcutter || 0, totalSaved);

            // Combined Stacked Bar (Saved)
            if (totalSaved > 0) {
                document.getElementById('bar-comb-speed').style.width = `${((saved.customSpeed || 0) / totalSaved) * 100}%`;
                document.getElementById('bar-comb-jump').style.width = `${((saved.jumpcutter || 0) / totalSaved) * 100}%`;
            }

            // --- Historical 7-Day Chart ---
            renderHistoryChart(history);
        });
    }

    function renderHistoryChart(historyObj) {
        const chart = document.getElementById('history-chart');
        if (!chart) return;
        
        chart.innerHTML = ''; // clear

        // Generate last 7 days array
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            const displayDate = d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
            
            days.push({
                date: displayDate,
                seconds: historyObj[iso] || 0
            });
        }

        // Find max to scale bars
        const maxSeconds = Math.max(...days.map(d => d.seconds), 3600); // minimum scale is 1 hour

        days.forEach(day => {
            const percentage = (day.seconds / maxSeconds) * 100;
            const minHeight = day.seconds > 0 ? Math.max(percentage, 5) : 0; // At least 5% height if > 0

            const col = document.createElement('div');
            col.className = 'history-col';
            
            col.innerHTML = `
                <div class="history-tooltip">${formatTime(day.seconds)}</div>
                <div class="history-bar" style="height: ${minHeight}%"></div>
                <div class="history-date">${day.date.split(',')[0]}</div>
            `;
            
            chart.appendChild(col);
        });
    }

    // Initial load
    updateGraphs();

    // Listen for real-time updates from background worker
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && (changes.detailedStudyTime || changes.detailedTimeSaved || changes.dailyHistory)) {
            updateGraphs();
        }
    });
});
