// background.js
importScripts("background/main.js");
let lastStudyUpdate = 0;

chrome.runtime.onInstalled.addListener(() => {
    // Explicitly disable jumpcutter on fresh install so it doesn't trigger unexpectedly
    chrome.storage.local.get(['skipSilence'], (res) => {
        if (res.skipSilence === undefined) {
            chrome.storage.local.set({ enabled: false, skipSilence: false });
        }
    });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "captureScreen") {
        // Capture the visible tab instead of the canvas to bypass DRM/CORS black screens
        chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }, (dataUrl) => {
            if (chrome.runtime.lastError || !dataUrl) {
                console.error("Capture failed:", chrome.runtime.lastError);
                return;
            }
            
            // Download the captured image into the organized folder
            chrome.downloads.download({
                url: dataUrl,
                filename: request.filename,
                saveAs: false // Download automatically without prompting
            });
        });
        return true; // Keep message channel open for async response
    } else if (request.action === "downloadUrl") {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: false
        });
        return true;
    } else if (request.action === "addStudyTime") {
        const now = Date.now();
        // Prevent double counting if messages come in too fast
        if (now - lastStudyUpdate >= 4000) { 
            lastStudyUpdate = now;
            const today = new Date().toLocaleDateString();
            
            // Define defaults
            const defaults = {
                studyData: { date: today, seconds: 0 },
                totalStudySeconds: 0,
                detailedStudyTime: { lectures: 0, notes: 0, dpps: 0 },
                detailedTimeSaved: { customSpeed: 0, jumpcutter: 0 },
                dailyHistory: {}
            };

            chrome.storage.local.get(defaults, (res) => {
                let data = res.studyData;
                let total = res.totalStudySeconds;
                let detailedTime = res.detailedStudyTime;
                let detailedSaved = res.detailedTimeSaved;
                let history = res.dailyHistory;
                
                // Keep the legacy today tracker just in case
                if (data.date !== today) {
                    data = { date: today, seconds: 0 };
                }
                
                data.seconds += 5; // adding 5 seconds per heartbeat
                total += 5;
                
                // Update history map
                const isoDate = new Date().toISOString().split('T')[0];
                if (!history[isoDate]) {
                    history[isoDate] = 0;
                }
                history[isoDate] += 5;
                
                if (request.type && detailedTime[request.type] !== undefined) {
                    detailedTime[request.type] += 5;
                }

                if (request.customSpeedSaved) {
                    detailedSaved.customSpeed += request.customSpeedSaved;
                }
                if (request.jumpcutterSaved) {
                    detailedSaved.jumpcutter += request.jumpcutterSaved;
                }
                
                chrome.storage.local.set({ 
                    studyData: data, 
                    totalStudySeconds: total,
                    detailedStudyTime: detailedTime,
                    detailedTimeSaved: detailedSaved,
                    dailyHistory: history
                });
            });
        }
    }
});
