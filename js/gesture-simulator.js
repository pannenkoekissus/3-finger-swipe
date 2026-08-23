/**
 * Interactive 3-Finger Touch Gesture Simulator
 * Handles touch screen multi-touch AND mouse drag simulation on Samsung Galaxy A57 mockup.
 */

class GestureSimulator {
    constructor(overlayEl, onGestureTriggered) {
        this.overlay = overlayEl;
        this.onGestureTriggered = onGestureTriggered;

        this.isDragging = false;
        this.startY = 0;
        this.startX = 0;
        this.currentY = 0;
        this.touchIndicators = [];

        this.sensitivityPx = 120;
        this.direction = 'down';
        this.isEnabled = true;

        this.initEventListeners();
    }

    setSettings(sensitivity, direction, isEnabled) {
        this.sensitivityPx = sensitivity;
        this.direction = direction;
        this.isEnabled = isEnabled;
    }

    initEventListeners() {
        // --- Mouse Simulation Events ---
        this.overlay.addEventListener('mousedown', (e) => this.handlePointerStart(e.clientX, e.clientY));
        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) this.handlePointerMove(e.clientX, e.clientY);
        });
        window.addEventListener('mouseup', () => {
            if (this.isDragging) this.handlePointerEnd();
        });

        // --- Real Touch Screen Events (Multi-touch) ---
        this.overlay.addEventListener('touchstart', (e) => {
            if (e.touches.length === 3) {
                e.preventDefault();
                const avgX = (e.touches[0].clientX + e.touches[1].clientX + e.touches[2].clientX) / 3;
                const avgY = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
                this.handlePointerStart(avgX, avgY);
            }
        });

        this.overlay.addEventListener('touchmove', (e) => {
            if (this.isDragging && e.touches.length === 3) {
                e.preventDefault();
                const avgX = (e.touches[0].clientX + e.touches[1].clientX + e.touches[2].clientX) / 3;
                const avgY = (e.touches[0].clientY + e.touches[1].clientY + e.touches[2].clientY) / 3;
                this.handlePointerMove(avgX, avgY);
            }
        });

        this.overlay.addEventListener('touchend', () => {
            if (this.isDragging) this.handlePointerEnd();
        });
    }

    handlePointerStart(x, y) {
        if (!this.isEnabled) return;

        this.isDragging = true;
        this.startX = x;
        this.startY = y;
        this.currentY = y;

        this.createTouchIndicators(x, y);
    }

    handlePointerMove(x, y) {
        if (!this.isDragging) return;
        this.currentY = y;
        this.updateTouchIndicators(x, y);

        const dy = y - this.startY;

        let thresholdMet = false;
        if (this.direction === 'down' && dy > this.sensitivityPx) {
            thresholdMet = true;
        } else if (this.direction === 'up' && dy < -this.sensitivityPx) {
            thresholdMet = true;
        } else if (this.direction === 'horizontal' && Math.abs(x - this.startX) > this.sensitivityPx) {
            thresholdMet = true;
        }

        if (thresholdMet) {
            this.isDragging = false;
            this.removeTouchIndicators();
            this.onGestureTriggered({ dy, direction: this.direction });
        }
    }

    handlePointerEnd() {
        this.isDragging = false;
        this.removeTouchIndicators();
    }

    createTouchIndicators(x, y) {
        this.removeTouchIndicators();
        const rect = this.overlay.getBoundingClientRect();
        const relativeX = x - rect.left;
        const relativeY = y - rect.top;

        // Create 3 finger touch dots spaced horizontally
        const offsets = [-30, 0, 30];
        offsets.forEach(offX => {
            const dot = document.createElement('div');
            dot.className = 'touch-point-indicator';
            dot.style.left = `${relativeX + offX}px`;
            dot.style.top = `${relativeY}px`;
            this.overlay.appendChild(dot);
            this.touchIndicators.push({ el: dot, offX });
        });
    }

    updateTouchIndicators(x, y) {
        const rect = this.overlay.getBoundingClientRect();
        const relativeX = x - rect.left;
        const relativeY = y - rect.top;

        this.touchIndicators.forEach(item => {
            item.el.style.left = `${relativeX + item.offX}px`;
            item.el.style.top = `${relativeY}px`;
        });
    }

    removeTouchIndicators() {
        this.touchIndicators.forEach(item => {
            if (item.el.parentNode) item.el.parentNode.removeChild(item.el);
        });
        this.touchIndicators = [];
    }
}
