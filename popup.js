document.addEventListener('DOMContentLoaded', () => {
    const showTrueTimeToggle = document.getElementById('show-truetime');
    const darkModeToggle = document.getElementById('dark-mode');
    const skipSilenceToggle = document.getElementById('skip-silence');
    const speedDropdown = document.getElementById('speed-dropdown');
    const skipSpeedDropdown = document.getElementById('skip-speed-dropdown');

    // Load saved settings
    chrome.storage.local.get({
        showTrueTime: true,
        darkMode: false,
        skipSilence: false,
        customSpeed: 1.0,
        skipSilenceSpeed: 4.5
    }, (items) => {
        showTrueTimeToggle.checked = items.showTrueTime;
        darkModeToggle.checked = items.darkMode;
        skipSilenceToggle.checked = items.skipSilence;
        speedDropdown.value = items.customSpeed;
        skipSpeedDropdown.value = items.skipSilenceSpeed;
    });

    // Handle toggles
    showTrueTimeToggle.addEventListener('change', (e) => {
        chrome.storage.local.set({ showTrueTime: e.target.checked });
    });

    darkModeToggle.addEventListener('change', (e) => {
        chrome.storage.local.set({ darkMode: e.target.checked });
    });

    skipSilenceToggle.addEventListener('change', (e) => {
        const speed = parseFloat(speedDropdown.value);
        const skipSpeed = parseFloat(skipSpeedDropdown.value);
        
        chrome.storage.local.set({ skipSilence: e.target.checked, enabled: e.target.checked }, () => {
            chrome.storage.local.set({ volumeThreshold: 0.006 }, () => {
                chrome.storage.local.set({ soundedSpeed: speed }, () => {
                    chrome.storage.local.set({ 
                        silenceSpeedSpecificationMethod: "absolute", 
                        silenceSpeedRaw: skipSpeed 
                    });
                });
            });
        });
    });

    skipSpeedDropdown.addEventListener('change', (e) => {
        const skipSpeed = parseFloat(e.target.value);
        
        chrome.storage.local.set({ skipSilenceSpeed: skipSpeed }, () => {
            chrome.storage.local.set({ silenceSpeedSpecificationMethod: "absolute" }, () => {
                chrome.storage.local.set({ silenceSpeedRaw: skipSpeed });
            });
        });
    });

    speedDropdown.addEventListener('change', (e) => {
        const speed = parseFloat(e.target.value);
        const skipSpeed = parseFloat(skipSpeedDropdown.value);
        
        chrome.storage.local.set({ customSpeed: speed }, () => {
            chrome.storage.local.set({ soundedSpeed: speed }, () => {
                chrome.storage.local.set({ silenceSpeedSpecificationMethod: "absolute" }, () => {
                    chrome.storage.local.set({ silenceSpeedRaw: skipSpeed });
                });
            });
        });
        
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: "setSpeed", speed: speed }).catch(() => {});
            }
        });
    });

    // Study Time Logic
    const studyTimeDisplay = document.getElementById('study-time-display');
    const totalTimeDisplay = document.getElementById('total-time-display');
    
    function formatStudyTime(seconds) {
        if (!seconds) return "00h 00m";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
    }

    function updateStudyTimeUI() {
        const today = new Date().toLocaleDateString();
        chrome.storage.local.get(['studyData', 'totalStudySeconds'], (res) => {
            const data = res.studyData;
            if (data && data.date === today) {
                studyTimeDisplay.textContent = formatStudyTime(data.seconds);
            } else {
                studyTimeDisplay.textContent = "00h 00m";
            }
            
            totalTimeDisplay.textContent = formatStudyTime(res.totalStudySeconds || 0);
        });
    }

    updateStudyTimeUI();

    // Listen for storage changes to update UI in real-time if popup is open
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.studyData) {
                const today = new Date().toLocaleDateString();
                const newData = changes.studyData.newValue;
                if (newData && newData.date === today) {
                    studyTimeDisplay.textContent = formatStudyTime(newData.seconds);
                }
            }
            if (changes.totalStudySeconds) {
                totalTimeDisplay.textContent = formatStudyTime(changes.totalStudySeconds.newValue);
            }
        }
    });

    const openAnalysisBtn = document.getElementById('open-analysis-btn');
    if (openAnalysisBtn) {
        openAnalysisBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('analysis.html') });
        });
    }
});
