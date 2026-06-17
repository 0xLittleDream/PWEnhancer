// Chart.js Default Configurations for Dark Theme
Chart.defaults.color = '#a1a1aa';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(9, 9, 11, 0.9)';
Chart.defaults.plugins.tooltip.titleColor = '#ffffff';
Chart.defaults.plugins.tooltip.bodyColor = '#ffffff';
Chart.defaults.plugins.tooltip.borderColor = '#27272a';
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.padding = 12;
Chart.defaults.plugins.tooltip.cornerRadius = 8;
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
Chart.defaults.scale.grid.borderColor = 'transparent';

let timelineChart;
let selectedDate = new Date();
let selectedMonth = new Date();
let isAllTimeSaved = false;

document.addEventListener('DOMContentLoaded', () => {
    function formatTime(totalSeconds) {
        if (!totalSeconds || isNaN(totalSeconds)) return "0h 0m";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m`;
    }

    function formatYeolputaTime(totalSeconds) {
        if (!totalSeconds || isNaN(totalSeconds)) return "0:00";
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        return `${h}:${m.toString().padStart(2, '0')}`;
    }

    function getIso(dateObj) {
        // adjust for timezone to get local YYYY-MM-DD
        const offset = dateObj.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(dateObj - offset)).toISOString().slice(0, 10);
        return localISOTime;
    }

    function isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    }

    function renderUI() {
        chrome.storage.local.get({
            detailedStudyTime: { lectures: 0, notes: 0, dpps: 0 },
            detailedTimeSaved: { customSpeed: 0, jumpcutter: 0 },
            dailyHistory: {},
            hourlyHistory: {},
            dailyCategoryHistory: {},
            dailySavedHistory: {}
        }, (res) => {
            const today = new Date();
            const selectedIso = getIso(selectedDate);
            
            // 1. Grand Total Header
            const grandTotalSaved = (res.detailedTimeSaved.customSpeed || 0) + (res.detailedTimeSaved.jumpcutter || 0);
            document.getElementById('grand-total-saved').textContent = formatTime(grandTotalSaved);

            // 2. Day Picker Labels
            const dayLabelEl = document.getElementById('current-day-label');
            const effDayLabelEl = document.getElementById('current-eff-day-label');
            const effDatePicker = document.getElementById('eff-date-picker');

            if (isSameDay(selectedDate, today)) {
                dayLabelEl.textContent = "Today";
                effDayLabelEl.textContent = "Today";
            } else {
                const formattedDate = selectedDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
                dayLabelEl.textContent = formattedDate;
                effDayLabelEl.textContent = formattedDate;
            }

            if (isAllTimeSaved) {
                effDatePicker.style.display = 'none';
            } else {
                effDatePicker.style.display = 'flex';
            }

            // 3. Render 24-hour Graph
            const hourly = res.hourlyHistory[selectedIso] || {};
            const hours = Array.from({length: 24}, (_, i) => `${i}:00`);
            const hourData = Array.from({length: 24}, (_, i) => (hourly[i.toString()] || 0) / 60); // minutes

            if (timelineChart) timelineChart.destroy();
            timelineChart = new Chart(document.getElementById('dailyTimelineChart'), {
                type: 'line',
                data: {
                    labels: hours,
                    datasets: [{
                        label: 'Study Minutes',
                        data: hourData,
                        borderColor: '#ffffff',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: '#ffffff',
                        pointRadius: 0,
                        pointHoverRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            suggestedMax: 60,
                            ticks: { stepSize: 10, callback: function(value) { return value + 'm'; } }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        tooltip: { callbacks: { label: (ctx) => `${Math.round(ctx.raw)} mins` } }
                    }
                }
            });

            // 4. Update Daily Breakdown Bars
            const dayCat = res.dailyCategoryHistory[selectedIso] || { lectures: 0, dpps: 0, notes: 0 };
            const dayStudyTotal = (dayCat.lectures || 0) + (dayCat.dpps || 0) + (dayCat.notes || 0);
            
            const updateBar = (id, value, total) => {
                const barEl = document.getElementById(`bar-${id}`);
                const valEl = document.getElementById(`val-${id}`);
                if (barEl && valEl) {
                    valEl.textContent = formatTime(value);
                    const percentage = total > 0 ? (value / total) * 100 : 0;
                    barEl.style.width = (value > 0 && percentage < 2) ? '2%' : `${percentage}%`;
                }
            };

            updateBar('lectures', dayCat.lectures || 0, dayStudyTotal);
            updateBar('dpps', dayCat.dpps || 0, dayStudyTotal);
            updateBar('notes', dayCat.notes || 0, dayStudyTotal);
            document.getElementById('stat-total-study').textContent = formatTime(dayStudyTotal);

            // 5. Update Efficiency Bars
            let effSpeed = 0, effJump = 0, effTotal = 0;
            if (isAllTimeSaved) {
                document.getElementById('saved-total-label').textContent = "Total Efficiency Bonus (All Time):";
                effSpeed = res.detailedTimeSaved.customSpeed || 0;
                effJump = res.detailedTimeSaved.jumpcutter || 0;
                effTotal = grandTotalSaved;
            } else {
                const daySaved = res.dailySavedHistory[selectedIso] || { customSpeed: 0, jumpcutter: 0 };
                document.getElementById('saved-total-label').textContent = "Total Efficiency Bonus (Selected Day):";
                effSpeed = daySaved.customSpeed || 0;
                effJump = daySaved.jumpcutter || 0;
                effTotal = effSpeed + effJump;
            }
            updateBar('speed', effSpeed, effTotal);
            updateBar('jump', effJump, effTotal);
            document.getElementById('stat-total-saved').textContent = formatTime(effTotal);

            // 6. Render Monthly Calendar
            document.getElementById('current-month-label').textContent = selectedMonth.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            
            const calGrid = document.querySelector('.calendar-grid');
            // Remove old cells, keep headers
            const headers = Array.from(calGrid.querySelectorAll('.cal-header'));
            calGrid.innerHTML = '';
            headers.forEach(h => calGrid.appendChild(h));

            const year = selectedMonth.getFullYear();
            const month = selectedMonth.getMonth();
            const firstDay = new Date(year, month, 1);
            const lastDay = new Date(year, month + 1, 0);
            
            // Adjust day so Monday is 0, Sunday is 6
            let startOffset = firstDay.getDay() - 1;
            if (startOffset === -1) startOffset = 6; 

            // Find max for scaling
            const allValues = Object.values(res.dailyHistory).filter(v => typeof v === 'number');
            const maxSeconds = allValues.length > 0 ? Math.max(...allValues) : 3600;

            // Empty slots for start
            for (let i = 0; i < startOffset; i++) {
                const empty = document.createElement('div');
                calGrid.appendChild(empty);
            }

            // Days
            for (let i = 1; i <= lastDay.getDate(); i++) {
                const cellDate = new Date(year, month, i);
                const iso = getIso(cellDate);
                const seconds = res.dailyHistory[iso] || 0;

                let level = 0;
                if (seconds > 0) {
                    const ratio = seconds / maxSeconds;
                    if (ratio > 0.75) level = 4;
                    else if (ratio > 0.5) level = 3;
                    else if (ratio > 0.25) level = 2;
                    else level = 1;
                }

                const cell = document.createElement('div');
                cell.className = 'cal-cell';
                if (isSameDay(cellDate, today)) cell.classList.add('today');
                if (level > 0) cell.classList.add(`heat-${level}`);

                const timeHtml = seconds > 0 ? `<div class="cal-time">⏱ ${formatYeolputaTime(seconds)}</div>` : '';

                cell.innerHTML = `
                    <div class="cal-date">${i}</div>
                    ${timeHtml}
                `;
                calGrid.appendChild(cell);
            }
        });
    }

    // Listeners
    document.getElementById('prev-day').addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        renderUI();
    });
    document.getElementById('next-day').addEventListener('click', () => {
        const today = new Date();
        if (selectedDate < today) {
            selectedDate.setDate(selectedDate.getDate() + 1);
            renderUI();
        }
    });

    document.getElementById('prev-eff-day').addEventListener('click', () => {
        selectedDate.setDate(selectedDate.getDate() - 1);
        renderUI();
    });
    document.getElementById('next-eff-day').addEventListener('click', () => {
        const today = new Date();
        if (selectedDate < today) {
            selectedDate.setDate(selectedDate.getDate() + 1);
            renderUI();
        }
    });

    document.getElementById('toggle-daily').addEventListener('click', (e) => {
        isAllTimeSaved = false;
        e.target.classList.add('active');
        document.getElementById('toggle-alltime').classList.remove('active');
        renderUI();
    });
    document.getElementById('toggle-alltime').addEventListener('click', (e) => {
        isAllTimeSaved = true;
        e.target.classList.add('active');
        document.getElementById('toggle-daily').classList.remove('active');
        renderUI();
    });

    document.getElementById('prev-month').addEventListener('click', () => {
        selectedMonth.setMonth(selectedMonth.getMonth() - 1);
        renderUI();
    });
    document.getElementById('next-month').addEventListener('click', () => {
        selectedMonth.setMonth(selectedMonth.getMonth() + 1);
        renderUI();
    });

    // Initial load
    renderUI();

    // Re-render when storage changes
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            renderUI();
        }
    });
});
