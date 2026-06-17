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
        skipSilenceSpeed: 4.5,
        marginBefore: 0.15,
        marginAfter: 0.1,
        volumeThreshold: 0.006
    }, (items) => {
        showTrueTimeToggle.checked = items.showTrueTime;
        darkModeToggle.checked = items.darkMode;
        skipSilenceToggle.checked = items.skipSilence;
        speedDropdown.value = items.customSpeed;
        skipSpeedDropdown.value = items.skipSilenceSpeed;
        
        const mb = document.getElementById('margin-before');
        const ma = document.getElementById('margin-after');
        const vt = document.getElementById('volume-threshold');
        if (mb) mb.value = items.marginBefore;
        if (ma) ma.value = items.marginAfter;
        if (vt) vt.value = items.volumeThreshold;
    });

    // Wire up advanced settings
    const wireInput = (id, key, isFloat = true) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', (e) => {
                const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
                chrome.storage.local.set({ [key]: val });
            });
        }
    };
    wireInput('margin-before', 'marginBefore');
    wireInput('margin-after', 'marginAfter');
    wireInput('volume-threshold', 'volumeThreshold');

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
            // Volume and margins are managed by the individual inputs, but we ensure speed is synced
            chrome.storage.local.set({ soundedSpeed: speed }, () => {
                chrome.storage.local.set({ 
                    silenceSpeedSpecificationMethod: "absolute", 
                    silenceSpeedRaw: skipSpeed 
                }, () => {
                    // The minified bundle doesn't unload jumpcutter when disabled. 
                    // We must reload the active PW tab to cleanly turn it off.
                    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                        if (tabs[0] && tabs[0].url && tabs[0].url.includes("pw.live")) {
                            chrome.tabs.reload(tabs[0].id);
                        }
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

    const openAnalysisBtn = document.getElementById('open-analysis-btn');
    if (openAnalysisBtn) {
        openAnalysisBtn.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('analysis.html') });
        });
    }

    // Load Today's Study Time
    const displayEl = document.getElementById('study-time-display');
    if (displayEl) {
        chrome.storage.local.get({ dailyHistory: {} }, (res) => {
            // Adjust to local ISO string
            const offset = new Date().getTimezoneOffset() * 60000;
            const todayIso = (new Date(Date.now() - offset)).toISOString().slice(0, 10);
            
            const seconds = res.dailyHistory[todayIso] || 0;
            const h = Math.floor(seconds / 3600);
            const m = Math.floor((seconds % 3600) / 60);
            displayEl.textContent = `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m`;
        });
    }
});
