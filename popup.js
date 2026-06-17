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
        skipSilence: true, // Jumpcutter defaults to true in the minified bundle
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
});
