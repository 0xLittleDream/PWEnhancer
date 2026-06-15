// background.js
let lastStudyUpdate = 0;

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
        // Prevent double counting if messages come in too fast (e.g. multiple tabs)
        // We expect a heartbeat every 5 seconds. If it comes in less than 4 seconds, ignore it.
        if (now - lastStudyUpdate >= 4000) { 
            lastStudyUpdate = now;
            const today = new Date().toLocaleDateString();
            
            chrome.storage.local.get({ studyData: { date: today, seconds: 0 } }, (res) => {
                let data = res.studyData;
                if (data.date !== today) {
                    data = { date: today, seconds: 0 };
                }
                data.seconds += 5; // adding 5 seconds per heartbeat
                chrome.storage.local.set({ studyData: data });
            });
        }
    }
});
