/**
 * Main Application Logic for 3-Finger Swipe Screenshot Simulator
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const serviceToggle = document.getElementById('service-toggle');
    const serviceStatusText = document.getElementById('service-status-text');
    const gestureDirection = document.getElementById('gesture-direction');
    const sensitivitySlider = document.getElementById('sensitivity-slider');
    const sensitivityVal = document.getElementById('sensitivity-val');
    const cooldownSlider = document.getElementById('cooldown-slider');
    const cooldownVal = document.getElementById('cooldown-val');
    const vibrationToggle = document.getElementById('vibration-toggle');
    const soundToggle = document.getElementById('sound-toggle');
    const btnTriggerManual = document.getElementById('btn-trigger-manual');
    const btnClearGallery = document.getElementById('btn-clear-gallery');

    const phoneScreen = document.getElementById('phone-screen');
    const touchOverlay = document.getElementById('gesture-touch-overlay');
    const screenshotFlash = document.getElementById('screenshot-flash');
    const screenshotToast = document.getElementById('screenshot-toast');
    const toastImg = document.getElementById('toast-img');

    const galleryContainer = document.getElementById('gallery-container');
    const emptyGallery = document.getElementById('empty-gallery');
    const galleryGrid = document.getElementById('gallery-grid');
    const captureCount = document.getElementById('capture-count');
    const logConsole = document.getElementById('log-console');

    const imageModal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    const modalTitle = document.getElementById('modal-title');
    const modalClose = document.getElementById('modal-close');

    const screenTime = document.getElementById('screen-time');

    let capturedScreenshots = [];
    let isCooldownActive = false;

    // --- Web Audio API Shutter Sound Synthesizer ---
    function playShutterSound() {
        if (!soundToggle.checked) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();

            // Noise burst for mechanical shutter
            const bufferSize = ctx.sampleRate * 0.05;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = ctx.createBufferSource();
            noise.buffer = buffer;

            const filter = ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.value = 1000;

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0.3, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(ctx.destination);

            noise.start();

            // Tone beep
            const osc = ctx.createOscillator();
            const oscGain = ctx.createGain();
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.04);
            oscGain.gain.setValueAtTime(0.15, ctx.currentTime);
            oscGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.04);

            osc.connect(oscGain);
            oscGain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.04);
        } catch (e) {
            console.log('Audio playback unavailable:', e);
        }
    }

    // --- Vibration Effect ---
    function triggerVibration() {
        if (!vibrationToggle.checked) return;
        if (navigator.vibrate) {
            navigator.vibrate(50);
        }
    }

    // --- Log Writer ---
    function addLog(msg, type = 'info') {
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.innerText = `[${time}] ${msg}`;
        logConsole.appendChild(entry);
        logConsole.scrollTop = logConsole.scrollHeight;
    }

    // --- Real-time Clock ---
    function updateClock() {
        const now = new Date();
        const hrs = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        screenTime.innerText = `${hrs}:${mins}`;
    }
    updateClock();
    setInterval(updateClock, 10000);

    // --- Initialize Gesture Simulator ---
    const simulator = new GestureSimulator(touchOverlay, (gestureData) => {
        handleScreenshotTrigger(`3-Finger ${gestureData.direction.toUpperCase()} Swipe`);
    });

    function syncSimulatorSettings() {
        const sensitivity = parseInt(sensitivitySlider.value, 10);
        const direction = gestureDirection.value;
        const active = serviceToggle.checked;

        sensitivityVal.innerText = `${sensitivity} px threshold`;
        cooldownVal.innerText = `${cooldownSlider.value} sec anti-repeat`;

        simulator.setSettings(sensitivity, direction, active);

        if (active) {
            serviceStatusText.className = 'status-indicator active';
            serviceStatusText.innerHTML = '<span class="dot"></span> Active & Running';
        } else {
            serviceStatusText.className = 'status-indicator';
            serviceStatusText.innerHTML = '<span class="dot"></span> Service Disabled';
        }
    }

    // Event Listeners for Controls
    serviceToggle.addEventListener('change', () => {
        syncSimulatorSettings();
        addLog(serviceToggle.checked ? 'Accessibility Service Enabled' : 'Accessibility Service Disabled', serviceToggle.checked ? 'info' : 'trigger');
    });

    gestureDirection.addEventListener('change', () => {
        syncSimulatorSettings();
        addLog(`Gesture Direction changed to: ${gestureDirection.value.toUpperCase()}`, 'info');
    });

    sensitivitySlider.addEventListener('input', syncSimulatorSettings);
    cooldownSlider.addEventListener('input', syncSimulatorSettings);

    // --- Screenshot Execution ---
    function handleScreenshotTrigger(source = 'Gesture') {
        if (!serviceToggle.checked) {
            addLog(`Screenshot blocked: Accessibility Service is Disabled!`, 'trigger');
            return;
        }

        if (isCooldownActive) {
            addLog(`Screenshot ignored: Cooldown active`, 'info');
            return;
        }

        // Apply Cooldown
        isCooldownActive = true;
        const cooldownMs = parseFloat(cooldownSlider.value) * 1000;
        setTimeout(() => {
            isCooldownActive = false;
        }, cooldownMs);

        // Feedback
        playShutterSound();
        triggerVibration();

        // Flash Animation
        screenshotFlash.classList.add('flash');
        setTimeout(() => {
            screenshotFlash.classList.remove('flash');
        }, 150);

        // Log entry
        addLog(`Screenshot Captured via ${source}!`, 'success');

        // Generate Screenshot Canvas Image
        generateScreenshotImage().then(dataUrl => {
            saveScreenshot(dataUrl);
            showOneUIToast(dataUrl);
        });
    }

    btnTriggerManual.addEventListener('click', () => {
        handleScreenshotTrigger('Manual Test Button');
    });

    // --- Screenshot Image Generator ---
    function generateScreenshotImage() {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            canvas.width = 1080;
            canvas.height = 2340;
            const ctx = canvas.getContext('2d');

            // Background Gradient (Samsung Galaxy UI)
            const grad = ctx.createLinearGradient(0, 0, 0, 2340);
            grad.addColorStop(0, '#1e1b4b');
            grad.addColorStop(0.5, '#0f172a');
            grad.addColorStop(1, '#090b13');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 1080, 2340);

            // Header Text
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 64px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Samsung Galaxy A57 5G', 540, 400);

            ctx.fillStyle = '#94a3b8';
            ctx.font = '40px sans-serif';
            ctx.fillText('Captured via 3-Finger Swipe Accessibility Service', 540, 490);

            // Draw Decorative Phone Widgets
            ctx.fillStyle = 'rgba(139, 92, 246, 0.2)';
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(140, 650, 800, 300, 40);
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 48px sans-serif';
            ctx.fillText('Screenshot Saved Successfully', 540, 800);

            ctx.fillStyle = '#a78bfa';
            ctx.font = '36px sans-serif';
            const nowStr = new Date().toLocaleString();
            ctx.fillText(nowStr, 540, 870);

            // Draw App Icons Grid
            const apps = ['Gallery', 'Camera', 'Settings', 'Notes', 'Clock', 'Browser', 'Music', 'Files'];
            apps.forEach((app, idx) => {
                const row = Math.floor(idx / 4);
                const col = idx % 4;
                const x = 160 + col * 200;
                const y = 1200 + row * 220;

                ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                ctx.beginPath();
                ctx.roundRect(x, y, 140, 140, 32);
                ctx.fill();

                ctx.fillStyle = '#e2e8f0';
                ctx.font = '28px sans-serif';
                ctx.fillText(app, x + 70, y + 185);
            });

            // Timestamp Stamp at bottom
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 2200, 1080, 140);
            ctx.fillStyle = '#64748b';
            ctx.font = '32px monospace';
            ctx.fillText('System Action: performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)', 540, 2280);

            resolve(canvas.toDataURL('image/png'));
        });
    }

    // --- Toast Popup ---
    function showOneUIToast(dataUrl) {
        toastImg.src = dataUrl;
        screenshotToast.classList.add('show');
        setTimeout(() => {
            screenshotToast.classList.remove('show');
        }, 3500);
    }

    // --- Save & Render Gallery ---
    function saveScreenshot(dataUrl) {
        const item = {
            id: Date.now(),
            dataUrl,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            filename: `Screenshot_${new Date().toISOString().slice(0,10)}_${Date.now().toString().slice(-4)}.png`
        };

        capturedScreenshots.unshift(item);
        renderGallery();
    }

    function renderGallery() {
        captureCount.innerText = capturedScreenshots.length;
        if (capturedScreenshots.length === 0) {
            emptyGallery.style.display = 'flex';
            galleryGrid.style.display = 'none';
        } else {
            emptyGallery.style.display = 'none';
            galleryGrid.style.display = 'grid';
            galleryGrid.innerHTML = '';

            capturedScreenshots.forEach(item => {
                const card = document.createElement('div');
                card.className = 'gallery-card';
                card.innerHTML = `
                    <img src="${item.dataUrl}" alt="Capture">
                    <div class="gallery-card-time">
                        <span>${item.time}</span>
                        <i class="fa-solid fa-expand"></i>
                    </div>
                `;
                card.addEventListener('click', () => openModal(item));
                galleryGrid.appendChild(card);
            });
        }
    }

    btnClearGallery.addEventListener('click', () => {
        capturedScreenshots = [];
        renderGallery();
        addLog('Captured screenshots cleared', 'info');
    });

    // --- Modal ---
    function openModal(item) {
        modalImg.src = item.dataUrl;
        modalTitle.innerText = item.filename;
        imageModal.classList.add('active');
    }

    modalClose.addEventListener('click', () => imageModal.classList.remove('active'));
    imageModal.addEventListener('click', (e) => {
        if (e.target === imageModal) imageModal.classList.remove('active');
    });

    // --- Navigation Tabs ---
    const navTabs = document.querySelectorAll('.nav-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');

    navTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetId = `tab-${tab.getAttribute('data-tab')}`;
            navTabs.forEach(t => t.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // --- Code Viewer Tabs ---
    const codeTabs = document.querySelectorAll('.code-tab');
    const codeContent = document.getElementById('code-content');

    function loadCodeFile(fileKey) {
        if (ANDROID_SOURCES[fileKey]) {
            codeContent.textContent = ANDROID_SOURCES[fileKey];
        }
    }

    codeTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            codeTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const fileKey = tab.getAttribute('data-file');
            loadCodeFile(fileKey);
        });
    });

    // Load initial code
    loadCodeFile('service');
});
