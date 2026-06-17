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
                dailyHistory: {},
                hourlyHistory: {}, // { "YYYY-MM-DD": { "0": 10, ... "23": 50 } }
                dailyCategoryHistory: {}, // { "YYYY-MM-DD": { lectures: 10, notes: 0, dpps: 5 } }
                dailySavedHistory: {} // { "YYYY-MM-DD": { customSpeed: 10, jumpcutter: 5 } }
            };

            chrome.storage.local.get(defaults, (res) => {
                let data = res.studyData;
                let total = res.totalStudySeconds;
                let detailedTime = res.detailedStudyTime;
                let detailedSaved = res.detailedTimeSaved;
                let history = res.dailyHistory;
                let hourly = res.hourlyHistory;
                let dailyCat = res.dailyCategoryHistory;
                let dailySaved = res.dailySavedHistory;
                
                // Keep the legacy today tracker just in case
                if (data.date !== today) {
                    data = { date: today, seconds: 0 };
                }
                
                data.seconds += 5; // adding 5 seconds per heartbeat
                total += 5;
                
                // Update history maps
                const now = new Date();
                const isoDate = now.toISOString().split('T')[0];
                const currentHour = now.getHours().toString(); // "0" to "23"
                
                if (!history[isoDate]) history[isoDate] = 0;
                history[isoDate] += 5;
                
                if (!hourly[isoDate]) hourly[isoDate] = {};
                if (!hourly[isoDate][currentHour]) hourly[isoDate][currentHour] = 0;
                hourly[isoDate][currentHour] += 5;
                
                if (!dailyCat[isoDate]) dailyCat[isoDate] = { lectures: 0, notes: 0, dpps: 0 };
                if (!dailySaved[isoDate]) dailySaved[isoDate] = { customSpeed: 0, jumpcutter: 0 };
                
                if (request.type && detailedTime[request.type] !== undefined) {
                    detailedTime[request.type] += 5;
                    dailyCat[isoDate][request.type] += 5;
                }

                if (request.customSpeedSaved) {
                    detailedSaved.customSpeed += request.customSpeedSaved;
                    dailySaved[isoDate].customSpeed += request.customSpeedSaved;
                }
                if (request.jumpcutterSaved) {
                    detailedSaved.jumpcutter += request.jumpcutterSaved;
                    dailySaved[isoDate].jumpcutter += request.jumpcutterSaved;
                }
                
                chrome.storage.local.set({ 
                    studyData: data, 
                    totalStudySeconds: total,
                    detailedStudyTime: detailedTime,
                    detailedTimeSaved: detailedSaved,
                    dailyHistory: history,
                    hourlyHistory: hourly,
                    dailyCategoryHistory: dailyCat,
                    dailySavedHistory: dailySaved
                });
            });
        }
    }
});
