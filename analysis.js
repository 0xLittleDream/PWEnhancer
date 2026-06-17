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
            detailedTimeSaved: { customSpeed: 0, jumpcutter: 0 }
        }, (res) => {
            const study = res.detailedStudyTime;
            const saved = res.detailedTimeSaved;

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
                    // Ensure a tiny sliver is visible if there's any time at all
                    barEl.style.width = (value > 0 && percentage < 2) ? '2%' : `${percentage}%`;
                }
            };

            updateBar('lectures', study.lectures || 0, totalStudy);
            updateBar('dpps', study.dpps || 0, totalStudy);
            updateBar('notes', study.notes || 0, totalStudy);

            // --- Time Saved Analytics Graph ---
            updateBar('speed', saved.customSpeed || 0, totalSaved);
            updateBar('jump', saved.jumpcutter || 0, totalSaved);
        });
    }

    // Initial load
    updateGraphs();

    // Listen for real-time updates from background worker
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && (changes.detailedStudyTime || changes.detailedTimeSaved)) {
            updateGraphs();
        }
    });
});
