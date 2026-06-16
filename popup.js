document.addEventListener('DOMContentLoaded', () => {
    const showTrueTimeToggle = document.getElementById('show-truetime');
    const darkModeToggle = document.getElementById('dark-mode');
    const speedDropdown = document.getElementById('speed-dropdown');

    // Load saved settings
    chrome.storage.sync.get({
        showTrueTime: true,
        darkMode: false,
        customSpeed: 1.0
    }, (items) => {
        showTrueTimeToggle.checked = items.showTrueTime;
        darkModeToggle.checked = items.darkMode;
        speedDropdown.value = items.customSpeed;
    });

    // Handle toggles
    showTrueTimeToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ showTrueTime: e.target.checked });
    });

    darkModeToggle.addEventListener('change', (e) => {
        chrome.storage.sync.set({ darkMode: e.target.checked });
    });

    // Handle dropdown change
    speedDropdown.addEventListener('change', (e) => {
        const speed = parseFloat(e.target.value);
        chrome.storage.sync.set({ customSpeed: speed });
        
        // Send direct message to active tab to update speed immediately
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "setSpeed", speed: speed }).catch(() => {});
            }
        });
    });

    // Study Time Logic
    const studyTimeDisplay = document.getElementById('study-time-display');
    
    function formatStudyTime(seconds) {
        if (!seconds) return "00h 00m";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
    }

    function updateStudyTimeUI() {
        const today = new Date().toLocaleDateString();
        chrome.storage.local.get('studyData', (res) => {
            const data = res.studyData;
            if (data && data.date === today) {
                studyTimeDisplay.textContent = formatStudyTime(data.seconds);
            } else {
                studyTimeDisplay.textContent = "00h 00m";
            }
        });
    }

    updateStudyTimeUI();

    // Listen for storage changes to update UI in real-time if popup is open
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.studyData) {
            const today = new Date().toLocaleDateString();
            const newData = changes.studyData.newValue;
            if (newData && newData.date === today) {
                studyTimeDisplay.textContent = formatStudyTime(newData.seconds);
            }
        }
    });
});
