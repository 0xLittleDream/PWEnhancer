// content.js
console.log("PW Enhancer: Content script loaded on " + window.location.href);

let currentSettings = {
    showTrueTime: true,
    darkMode: false,
    customSpeed: 1.0
};

// Inject CSS for Zen Mode and Toggles
const styleEl = document.createElement('style');
styleEl.id = 'pw-truetime-styles';
// Insert as early as possible
if (document.head) {
    document.head.appendChild(styleEl);
} else {
    document.documentElement.appendChild(styleEl);
}

function updateStyles() {
    let css = '';
    
    if (!currentSettings.showTrueTime) {
        css += '#pw-truetime-timer { display: none !important; }\n';
    }
    
    // Auto-hide cursor logic
    css += 'body.pw-hide-cursor, body.pw-hide-cursor * { cursor: none !important; }\n';

    const isWatchPage = window.location.href.includes('/watch') || window.location.href.includes('streamfiles.eu.org');
    const isPwLive = window.location.hostname.includes('pw.live');

    if (currentSettings.darkMode && isPwLive && !isWatchPage) {
        css += `
            html {
                filter: invert(1) hue-rotate(180deg) brightness(0.95) contrast(0.9) !important;
                background: white !important;
            }
            img:not([src*="logo"]):not([alt*="logo"]):not([class*="logo"]), 
            video, canvas, iframe, picture, .pw-lightbox-btn, .pw-download-btn, [style*="background-image"] {
                filter: invert(1) hue-rotate(180deg) !important;
            }
            body {
                background: white !important;
            }
        `;
    }
    
    styleEl.textContent = css;
}

function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0 || !isFinite(seconds)) return "00:00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map(v => v < 10 ? '0' + v : v).join(':');
}

function formatFinishTime(date) {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
}

function applyCustomSpeed(video) {
    if (!video) return;
    if (currentSettings.customSpeed) {
        video.playbackRate = currentSettings.customSpeed;
    }
}

function getLectureName() {
    let name = "";
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refParams = document.referrer ? new URLSearchParams(new URL(document.referrer).search) : null;
        
        if (urlParams.has('topic')) name = urlParams.get('topic');
        else if (refParams && refParams.has('topic')) name = refParams.get('topic');
        else if (urlParams.has('subject')) name = urlParams.get('subject');
        else if (refParams && refParams.has('subject')) name = refParams.get('subject');
        
        if (name) {
            name = name.replace(/_/g, ' ').trim();
        } else {
            if (window.top && window.top.document && window.top.document.title) {
                name = window.top.document.title.split('|')[0].split('-')[0].trim();
            } else if (document.title) {
                name = document.title.split('|')[0].split('-')[0].trim();
            }
        }
    } catch(err) {}
    
    if (name.includes("PW Video Player")) name = "";
    name = name.replace(/[\\\\/:*?"<>|]/g, '').trim();
    return name || "PW_Lecture";
}

// Load initial settings
if (chrome && chrome.storage) {
    // FORCE OFF JUMPCUTTER BY DEFAULT
    chrome.storage.local.get(['skipSilence', 'enabled'], (res) => {
        if (res.skipSilence === undefined || res.enabled === undefined) {
            chrome.storage.local.set({ skipSilence: false, enabled: false });
        }
    });

    chrome.storage.local.get({
        showTrueTime: true,
        darkMode: false,
        skipSilence: false,
        customSpeed: 1.0
    }, (items) => {
        currentSettings = items;
    });

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.showTrueTime !== undefined) {
                currentSettings.showTrueTime = changes.showTrueTime.newValue;
                const timerElement = document.getElementById('pw-truetime-timer');
                if (timerElement) {
                    timerElement.style.display = currentSettings.showTrueTime ? 'flex' : 'none';
                }
            }
            if (changes.darkMode !== undefined) {
                currentSettings.darkMode = changes.darkMode.newValue;
                updateStyles();
            }
            if (changes.skipSilence !== undefined) {
                currentSettings.skipSilence = changes.skipSilence.newValue;
            }
            if (changes.customSpeed !== undefined) {
                currentSettings.customSpeed = changes.customSpeed.newValue;
                const video = document.querySelector('video.vjs-tech');
                applyCustomSpeed(video);
            }
        }
    });

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === "setSpeed") {
            currentSettings.customSpeed = request.speed;
            const video = document.querySelector('video.vjs-tech');
            applyCustomSpeed(video);
        }
    });
}

function injectTimer() {
    const video = document.querySelector('video.vjs-tech');
    const header = document.querySelector('.player-header');
    
    // Check if we already injected the timer to prevent duplicates
    if (document.getElementById('pw-truetime-timer')) {
        // If it exists, make sure we occasionally enforce custom speed on navigation
        if (video && currentSettings.customSpeed !== 1.0 && video.playbackRate !== currentSettings.customSpeed) {
            // Uncomment to force speed on every navigation: applyCustomSpeed(video);
        }
        return true;
    }

    if (!video) return false;

    // Create container
    const timerContainer = document.createElement('div');
    timerContainer.id = 'pw-truetime-timer';
    
    // PW Theme inspired styling
    timerContainer.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: rgba(17, 24, 39, 0.85);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        color: #F3F4F6;
        font-family: 'Inter', system-ui, -apple-system, sans-serif;
        font-size: 13px;
        font-weight: 600;
        padding: 4px 6px;
        border-radius: 9999px;
        margin: 0 16px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.08);
        z-index: 9999;
        transition: opacity 0.3s ease, visibility 0.3s ease;
        user-select: none;
        opacity: 0;
        visibility: hidden;
    `;

    // 1. Time display section
    const timeSection = document.createElement('div');
    timeSection.style.cssText = "display: flex; align-items: center; padding: 0 8px;";
    
    const iconSvg = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 7px; color: #3B82F6;">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
    `;

    const timeText = document.createElement('span');
    timeText.textContent = "Calculating...";
    timeText.style.letterSpacing = "0.3px";
    
    timeSection.innerHTML = iconSvg;
    timeSection.appendChild(timeText);

    // 2. Divider
    const divider = document.createElement('div');
    divider.style.cssText = "width: 1px; height: 16px; background: rgba(255,255,255,0.2); margin: 0 4px;";

    // 3. Speed Controls section
    const speedSection = document.createElement('div');
    speedSection.style.cssText = "display: flex; align-items: center; gap: 4px; padding: 0 4px;";

    const btnStyle = `
        background: transparent;
        border: none;
        color: #F3F4F6;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
        font-size: 16px;
        font-weight: 500;
        line-height: 1;
        padding-bottom: 2px;
    `;

    const minusBtn = document.createElement('button');
    minusBtn.innerHTML = '&minus;';
    minusBtn.style.cssText = btnStyle;
    minusBtn.onmouseover = () => minusBtn.style.background = 'rgba(255,255,255,0.1)';
    minusBtn.onmouseout = () => minusBtn.style.background = 'transparent';

    const speedLabel = document.createElement('span');
    speedLabel.style.cssText = "width: 44px; text-align: center; font-variant-numeric: tabular-nums;";
    speedLabel.textContent = "1.00x";

    const plusBtn = document.createElement('button');
    plusBtn.innerHTML = '&#43;';
    plusBtn.style.cssText = btnStyle;
    plusBtn.onmouseover = () => plusBtn.style.background = 'rgba(255,255,255,0.1)';
    plusBtn.onmouseout = () => plusBtn.style.background = 'transparent';

    speedSection.appendChild(minusBtn);
    speedSection.appendChild(speedLabel);
    speedSection.appendChild(plusBtn);

    // 4. Slide Capture section
    const captureSection = document.createElement('div');
    captureSection.style.cssText = "display: flex; align-items: center; padding: 0 4px;";
    
    const captureBtn = document.createElement('button');
    captureBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
        </svg>
    `;
    captureBtn.style.cssText = btnStyle;
    captureBtn.title = "Take clean screenshot";

    captureBtn.onmouseover = () => captureBtn.style.background = 'rgba(255,255,255,0.1)';
    captureBtn.onmouseout = () => captureBtn.style.background = 'transparent';

    captureBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const lectureName = getLectureName();
        const timestamp = formatTime(video.currentTime).replace(/:/g, '-');
        const filename = `Physics Wallah/${lectureName}/PW_Slide_${timestamp}.png`;
        
        // Request background script to capture the tab (bypasses DRM/CORS black screens)
        chrome.runtime.sendMessage({ action: "captureScreen", filename: filename });

        // Visual feedback
        captureBtn.style.color = '#10B981'; // Success Green
        setTimeout(() => captureBtn.style.color = '#F3F4F6', 1000);
    });

    captureSection.appendChild(captureBtn);

    // 5. Jumpcutter Toggle Section
    const jumpcutterSection = document.createElement('div');
    jumpcutterSection.style.cssText = "display: flex; align-items: center; padding: 0 4px;";
    
    const jumpBtn = document.createElement('button');
    jumpBtn.innerHTML = `
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="13 19 22 12 13 5 13 19"></polygon>
            <polygon points="2 19 11 12 2 5 2 19"></polygon>
        </svg>
    `;
    jumpBtn.style.cssText = btnStyle;
    jumpBtn.title = "Jumpcutter (Skip Silence)";

    const updateJumpBtnState = () => {
        if (currentSettings.skipSilence) {
            jumpBtn.style.color = '#10B981'; // Green
        } else {
            jumpBtn.style.color = '#F3F4F6'; // Gray
        }
    };
    // Initialize color on load
    updateJumpBtnState();

    jumpBtn.onmouseover = () => jumpBtn.style.background = 'rgba(255,255,255,0.1)';
    jumpBtn.onmouseout = () => jumpBtn.style.background = 'transparent';

    jumpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const newState = !currentSettings.skipSilence;
        
        if (!newState) {
            // Minified script cannot be cleanly stopped without reload
            const confirmReload = confirm("Jumpcutter disabled. The page must reload to cleanly unload the audio engine. Reload now?");
            if (!confirmReload) {
                // User cancelled, keep it on
                return;
            }
        }
        
        chrome.storage.local.set({ skipSilence: newState, enabled: newState }, () => {
            currentSettings.skipSilence = newState;
            updateJumpBtnState();
            
            if (!newState) {
                window.location.reload();
            } else {
                // Ensure default speeds are set when turning on
                chrome.storage.local.get({ 
                    skipSilenceSpeed: 4.5, 
                    customSpeed: parseFloat(speedLabel.textContent) || 1.0,
                    marginBefore: 0.15,
                    marginAfter: 0.1,
                    volumeThreshold: 0.005
                }, (items) => {
                    chrome.storage.local.set({
                        volumeThreshold: items.volumeThreshold,
                        marginBefore: items.marginBefore,
                        marginAfter: items.marginAfter,
                        soundedSpeed: items.customSpeed,
                        silenceSpeedSpecificationMethod: "absolute",
                        silenceSpeedRaw: items.skipSilenceSpeed
                    });
                });
            }
        });
    });

    jumpcutterSection.appendChild(jumpBtn);

    const mainRow = document.createElement('div');
    mainRow.style.cssText = "display: flex; align-items: center;";
    mainRow.appendChild(timeSection);
    mainRow.appendChild(divider);
    mainRow.appendChild(speedSection);
    mainRow.appendChild(captureSection);
    mainRow.appendChild(jumpcutterSection);

    // Assemble Pill
    timerContainer.appendChild(mainRow);

    header.appendChild(timerContainer);

    // Auto-Hide Logic
    let hideTimerTimeout;
    const showPill = () => {
        timerContainer.style.opacity = '1';
        timerContainer.style.visibility = 'visible';
        document.body.classList.remove('pw-hide-cursor');

        clearTimeout(hideTimerTimeout);
        
        const activeVideo = document.querySelector('video.vjs-tech') || document.querySelector('video');
        if (activeVideo && activeVideo.paused) return;

        hideTimerTimeout = setTimeout(() => {
            timerContainer.style.opacity = '0';
            timerContainer.style.visibility = 'hidden';
            document.body.classList.add('pw-hide-cursor');
        }, 2500);
    };

    document.addEventListener('mousemove', showPill);
    document.addEventListener('mouseenter', showPill);
    document.addEventListener('mouseleave', () => {
        const activeVideo = document.querySelector('video.vjs-tech') || document.querySelector('video');
        if (activeVideo && activeVideo.paused) return;
        clearTimeout(hideTimerTimeout);
        timerContainer.style.opacity = '0';
        timerContainer.style.visibility = 'hidden';
        document.body.classList.add('pw-hide-cursor');
    });

    timerContainer.addEventListener('mouseenter', () => {
        clearTimeout(hideTimerTimeout);
        timerContainer.style.opacity = '1';
        timerContainer.style.visibility = 'visible';
        document.body.classList.remove('pw-hide-cursor');
    });
    timerContainer.addEventListener('mouseleave', showPill);

    if (video) {
        video.addEventListener('play', showPill);
        video.addEventListener('pause', showPill);
    }

    // Speed Control Logic
    const setSpeed = (newSpeed) => {
        newSpeed = Math.max(0.25, Math.min(4.0, newSpeed));
        currentSettings.customSpeed = newSpeed;
        video.playbackRate = newSpeed;
        chrome.storage.local.set({ customSpeed: newSpeed });
        speedLabel.textContent = newSpeed.toFixed(2) + 'x';
    };

    minusBtn.addEventListener('click', (e) => { e.stopPropagation(); setSpeed(currentSettings.customSpeed - 0.25); });
    plusBtn.addEventListener('click', (e) => { e.stopPropagation(); setSpeed(currentSettings.customSpeed + 0.25); });

    const updateTrueTime = () => {
        if (!video.duration) return;
        const remainingSeconds = video.duration - video.currentTime;
        const playbackRate = video.playbackRate || 1;
        const trueRemainingSeconds = remainingSeconds / playbackRate;
        
        const finishDate = new Date(Date.now() + trueRemainingSeconds * 1000);
        const finishTimeStr = formatFinishTime(finishDate);
        
        timeText.textContent = `True Time Left: ${formatTime(trueRemainingSeconds)} (Finish on ${finishTimeStr})`;
        speedLabel.textContent = playbackRate.toFixed(2) + 'x';
        currentSettings.customSpeed = playbackRate;
    };

    video.addEventListener('timeupdate', updateTrueTime);
    video.addEventListener('ratechange', updateTrueTime);
    video.addEventListener('loadedmetadata', updateTrueTime);
    
    updateTrueTime();
    
    // Apply custom speed if set
    applyCustomSpeed(video);

    return true;
}

// --- LIGHTBOX FEATURE ---
function openLightbox(imageUrl) {
    if (document.getElementById('pw-truetime-lightbox')) return;

    const overlay = document.createElement('div');
    overlay.id = 'pw-truetime-lightbox';
    overlay.style.cssText = `
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: rgba(0, 0, 0, 0.9);
        background-image: ${imageUrl};
        background-size: contain;
        background-position: center;
        background-repeat: no-repeat;
        z-index: 999999;
        cursor: zoom-out;
        transition: opacity 0.2s ease;
    `;

    const closeInstruction = document.createElement('div');
    closeInstruction.textContent = "Click anywhere or press Escape to close";
    closeInstruction.style.cssText = `
        position: absolute;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        color: rgba(255, 255, 255, 0.6);
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        background: rgba(0,0,0,0.5);
        padding: 8px 16px;
        border-radius: 20px;
        pointer-events: none;
    `;

    overlay.appendChild(closeInstruction);

    const captureLightboxBtn = document.createElement('div');
    captureLightboxBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
            <circle cx="12" cy="13" r="4"></circle>
        </svg>
        <span style="margin-left:8px;">Capture High-Res</span>
    `;
    captureLightboxBtn.style.cssText = `
        position: absolute;
        top: 20px;
        right: 20px;
        background: rgba(16, 185, 129, 0.9);
        color: white;
        padding: 10px 20px;
        border-radius: 8px;
        display: flex;
        align-items: center;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        z-index: 9999999;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
        transition: transform 0.2s;
        backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,0.2);
    `;
    captureLightboxBtn.onmouseover = () => captureLightboxBtn.style.transform = 'scale(1.05)';
    captureLightboxBtn.onmouseout = () => captureLightboxBtn.style.transform = 'scale(1)';

    captureLightboxBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // prevent closing
        
        const lectureName = getLectureName();
        const filename = `Physics Wallah/${lectureName}/PW_Slide_${Date.now()}.png`;

        chrome.runtime.sendMessage({ action: "captureScreen", filename: filename });

        captureLightboxBtn.style.background = '#059669'; // darker green
        captureLightboxBtn.innerHTML = "Captured! ✅";
        setTimeout(() => {
            // reset
            captureLightboxBtn.style.background = 'rgba(16, 185, 129, 0.9)';
            captureLightboxBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                </svg>
                <span style="margin-left:8px;">Capture High-Res</span>
            `;
        }, 2000);
    });

    overlay.appendChild(captureLightboxBtn);

    // Close on click
    overlay.addEventListener('click', () => {
        overlay.remove();
    });

    // Close on Escape
    const escapeListener = (e) => {
        if (e.key === 'Escape') {
            overlay.remove();
            document.removeEventListener('keydown', escapeListener);
        }
    };
    document.addEventListener('keydown', escapeListener);

    document.body.appendChild(overlay);
}

function injectLightboxButtons() {
    // PW slides are usually divs with id starting with 'timeline-'
    const timelineElements = document.querySelectorAll('div[id^="timeline-"]');
    
    timelineElements.forEach(el => {
        // Only inject if not already injected
        if (el.querySelector('.pw-lightbox-btn')) return;

        // Only inject into the actual thumbnail div that has the background image
        const bgImage = el.style.backgroundImage;
        if (!bgImage || bgImage === 'none') return;

        // Ensure parent is relative so we can absolute position the button
        if (window.getComputedStyle(el).position === 'static') {
            el.style.position = 'relative';
        }

        const btn = document.createElement('div');
        btn.className = 'pw-lightbox-btn';
        // Professional expand SVG icon
        btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        `;
        btn.style.cssText = `
            position: absolute;
            top: 6px;
            right: 6px;
            background: rgba(15, 23, 42, 0.9);
            color: #60A5FA;
            border-radius: 6px;
            padding: 6px;
            cursor: zoom-in;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(96, 165, 250, 0.3);
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            backdrop-filter: blur(4px);
            transition: all 0.2s ease;
        `;
        
        // Hover effect for the button itself (slight scale and color change)
        btn.addEventListener('mouseenter', () => {
            btn.style.background = '#3B82F6';
            btn.style.color = '#FFFFFF';
            btn.style.transform = 'scale(1.05)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(15, 23, 42, 0.9)';
            btn.style.color = '#60A5FA';
            btn.style.transform = 'scale(1)';
        });

        btn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent the video from seeking!
            // Read the background-image from the timeline element
            const bgImage = el.style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                openLightbox(bgImage);
            }
        });

        el.appendChild(btn);

        const downloadBtn = document.createElement('div');
        downloadBtn.className = 'pw-download-btn';
        downloadBtn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
        `;
        downloadBtn.style.cssText = btn.style.cssText; // same styles as expand
        downloadBtn.style.right = '36px'; // offset left of expand btn
        downloadBtn.title = "Download Slide";
        
        downloadBtn.addEventListener('mouseenter', () => {
            downloadBtn.style.background = '#10B981'; // Green
            downloadBtn.style.color = '#FFFFFF';
            downloadBtn.style.transform = 'scale(1.05)';
        });
        downloadBtn.addEventListener('mouseleave', () => {
            downloadBtn.style.background = 'rgba(15, 23, 42, 0.9)';
            downloadBtn.style.color = '#60A5FA';
            downloadBtn.style.transform = 'scale(1)';
        });

        downloadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bgImage = el.style.backgroundImage;
            if (bgImage && bgImage !== 'none') {
                const url = bgImage.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '');
                
                const lectureName = getLectureName();
                const filename = `Physics Wallah/${lectureName}/PW_Slide_${Date.now()}.png`;

                chrome.runtime.sendMessage({ action: "downloadUrl", url: url, filename: filename });

                downloadBtn.style.color = '#10B981';
                setTimeout(() => downloadBtn.style.color = '#60A5FA', 1000);
            }
        });

        el.appendChild(downloadBtn);
    });
}

const observer = new MutationObserver((mutations, obs) => {
    injectTimer();
    injectLightboxButtons();
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

injectTimer();
injectLightboxButtons();

// --- DETAILED STUDY & TIME SAVED TRACKER ---
let accumulatedCustomSaved = 0;
let accumulatedJumpSaved = 0;

let lastVideoTime = -1;
let lastRealTime = -1;

const video = document.querySelector('video.vjs-tech') || document.querySelector('video');
if (video) {
    video.addEventListener('timeupdate', () => {
        const currentVideoTime = video.currentTime;
        const currentRealTime = performance.now();
        
        if (lastVideoTime !== -1 && lastRealTime !== -1 && !video.paused) {
            const deltaV = currentVideoTime - lastVideoTime;
            const deltaT = (currentRealTime - lastRealTime) / 1000;
            
            // Ignore massive jumps (seeking) larger than 10 seconds
            if (deltaV > 0 && deltaV < 10.0) {
                const Sc = currentSettings.customSpeed || 1.0;
                
                let customSpeedSaved = deltaV - (deltaV / Sc);
                let jumpcutterSaved = (deltaV / Sc) - deltaT;
                
                if (customSpeedSaved > 0) accumulatedCustomSaved += customSpeedSaved;
                if (jumpcutterSaved > 0) accumulatedJumpSaved += jumpcutterSaved;
            }
        }
        
        lastVideoTime = currentVideoTime;
        lastRealTime = currentRealTime;
    });

    const resetTracker = () => {
        lastVideoTime = video.currentTime;
        lastRealTime = performance.now();
    };
    
    video.addEventListener('seeking', resetTracker);
    video.addEventListener('seeked', resetTracker);
    video.addEventListener('playing', resetTracker);
}

setInterval(() => {
    // As long as the document isn't completely hidden (or video is playing), track it.
    if (!document.hidden || (video && !video.paused)) {
        const url = window.location.href;
        if (url.includes('/watch') || url.includes('streamfiles.eu.org')) {
            let data = { action: "addStudyTime", type: "lectures" };
            if (accumulatedCustomSaved > 0 || accumulatedJumpSaved > 0) {
                data.customSpeedSaved = accumulatedCustomSaved;
                data.jumpcutterSaved = accumulatedJumpSaved;
                accumulatedCustomSaved = 0;
                accumulatedJumpSaved = 0;
            }
            chrome.runtime.sendMessage(data).catch(() => {});
        } else if (url.includes('/practice-v2')) {
            chrome.runtime.sendMessage({ action: "addStudyTime", type: "dpps" }).catch(() => {});
        } else if (url.includes('/study-v2/notes')) {
            chrome.runtime.sendMessage({ action: "addStudyTime", type: "notes" }).catch(() => {});
        } else {
            // Backup tracker for unknown PW pages
            chrome.runtime.sendMessage({ action: "addStudyTime" }).catch(() => {});
        }
    }
}, 5000);


