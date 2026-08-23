package com.galaxy.threefingerswipe

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.accessibilityservice.TouchInteractionController
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.util.Log
import android.view.Display
import android.view.InputDevice
import android.view.MotionEvent
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast

/**
 * System-Wide 3-Finger Swipe Screenshot Accessibility Service
 * Optimized for Samsung Galaxy A57 5G & Android 14/15 One UI 6/7.
 */
class ThreeFingerSwipeAccessibilityService : AccessibilityService() {

    private lateinit var gestureDetector: GestureDetectorHelper
    private var vibrator: Vibrator? = null
    private var prefs: SharedPreferences? = null

    private var lastScreenshotTime: Long = 0

    private var mainHandler: Handler? = null
    private var touchController: TouchInteractionController? = null
    private var pendingDelegateRunnable: Runnable? = null
    private var isDelegating = false
    private var isIntercepting = false
    private var downX = 0f
    private var downY = 0f

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "3-Finger Swipe Accessibility Service Connected!")

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        prefs = getSharedPreferences("swipe_settings", Context.MODE_PRIVATE)

        configureServiceInfo()

        val threshold = prefs?.getInt("threshold_px", 120) ?: 120
        val dir = prefs?.getString("direction", "DOWN") ?: "DOWN"

        gestureDetector = GestureDetectorHelper(
            minSwipeDistancePx = threshold,
            direction = dir,
            onSwipeDetected = { triggerScreenshot() },
            onFingersDetected = {
                Log.d(TAG, "3 Fingers Detected on touchscreen")
            }
        )

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            mainHandler = Handler(Looper.getMainLooper())
            touchController = getTouchInteractionController(Display.DEFAULT_DISPLAY)
            touchController?.registerCallback(null, object : TouchInteractionController.Callback {
                override fun onMotionEvent(event: MotionEvent) {
                    handleTouchInteraction(event)
                }

                override fun onStateChanged(state: Int) {
                    if (state == TouchInteractionController.STATE_CLEAR) {
                        isDelegating = false
                        isIntercepting = false
                    }
                }
            })
            Log.i(TAG, "TouchInteractionController passthrough gesture detection active")
        }

        showToast("3-Finger Swipe Screenshot Service Active!")
    }

    private fun configureServiceInfo() {
        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 100

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                flags = AccessibilityServiceInfo.DEFAULT or
                        AccessibilityServiceInfo.FLAG_REQUEST_TOUCH_EXPLORATION_MODE
            } else {
                flags = AccessibilityServiceInfo.DEFAULT or
                        AccessibilityServiceInfo.FLAG_REQUEST_MULTI_FINGER_GESTURES or
                        AccessibilityServiceInfo.FLAG_SEND_MOTION_EVENTS

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    try {
                        setMotionEventSources(InputDevice.SOURCE_TOUCHSCREEN)
                        Log.i(TAG, "AccessibilityServiceInfo setMotionEventSources TOUCHSCREEN enabled")
                    } catch (e: Exception) {
                        Log.e(TAG, "Failed to set motion event sources", e)
                    }
                }
            }
        }
        setServiceInfo(info)
    }

    private fun handleTouchInteraction(event: MotionEvent) {
        val isServiceActive = prefs?.getBoolean("service_active", true) ?: true
        if (!isServiceActive) {
            delegateToApps()
            return
        }

        if (isDelegating) return

        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                isIntercepting = false
                downX = event.x
                downY = event.y
                scheduleFallbackDelegate()
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                cancelPendingDelegate()
                val wasIntercepting = isIntercepting
                isIntercepting = false
                gestureDetector.processMotionEvent(event)
                if (event.actionMasked == MotionEvent.ACTION_UP &&
                    !wasIntercepting && !isDelegating
                ) {
                    delegateToApps()
                }
                return
            }
        }

        if (event.pointerCount >= 3) {
            isIntercepting = true
            cancelPendingDelegate()
            gestureDetector.processMotionEvent(event)
            return
        }

        if (!isIntercepting) {
            val dx = event.x - downX
            val dy = event.y - downY
            if (dx * dx + dy * dy > FALLBACK_SLOP_PX * FALLBACK_SLOP_PX) {
                delegateToApps()
            }
        }
    }

    private fun scheduleFallbackDelegate() {
        cancelPendingDelegate()
        val runnable = Runnable { delegateToApps() }
        pendingDelegateRunnable = runnable
        mainHandler?.postDelayed(runnable, DELEGATE_DELAY_MS)
    }

    private fun cancelPendingDelegate() {
        pendingDelegateRunnable?.let { mainHandler?.removeCallbacks(it) }
        pendingDelegateRunnable = null
    }

    private fun delegateToApps() {
        cancelPendingDelegate()
        if (isDelegating) return
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val controller = touchController ?: return
        if (controller.state != TouchInteractionController.STATE_TOUCH_INTERACTING) return

        isDelegating = true
        try {
            controller.requestDelegating()
            Log.d(TAG, "Non-3-finger touch delegated to apps")
        } catch (e: Exception) {
            Log.e(TAG, "requestDelegating failed", e)
            isDelegating = false
        }
    }

    override fun onMotionEvent(event: MotionEvent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) return

        val isServiceActive = prefs?.getBoolean("service_active", true) ?: true
        if (isServiceActive) {
            gestureDetector.processMotionEvent(event)
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used for motion gesture handling
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility Service interrupted")
    }

    override fun onDestroy() {
        cancelPendingDelegate()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            touchController?.unregisterAllCallbacks()
        }
        super.onDestroy()
    }

    private fun triggerScreenshot() {
        val now = System.currentTimeMillis()
        val cooldownSec = prefs?.getFloat("cooldown_sec", 0.8f) ?: 0.8f
        val cooldownMs = (cooldownSec * 1000).toLong()

        if (now - lastScreenshotTime < cooldownMs) {
            Log.d(TAG, "Screenshot ignored: inside cooldown window")
            return
        }
        lastScreenshotTime = now

        Log.i(TAG, "Triggering Screenshot Global Action")

        // Trigger vibration feedback
        if (prefs?.getBoolean("vibration_enabled", true) != false) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                vibrator?.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(50)
            }
        }

        // Perform Android native screenshot global action
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val success = performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
            Log.i(TAG, "GLOBAL_ACTION_TAKE_SCREENSHOT result: $success")
            if (success) {
                showToast("Screenshot Taken! 📸")
            }
        } else {
            Log.e(TAG, "Screenshot action requires Android 9.0+")
        }
    }

    private fun showToast(msg: String) {
        try {
            Toast.makeText(applicationContext, msg, Toast.LENGTH_SHORT).show()
        } catch (e: Exception) {
            Log.e(TAG, "Toast error", e)
        }
    }

    companion object {
        private const val TAG = "3FingerSwipeService"
        private const val DELEGATE_DELAY_MS = 300L
        private const val FALLBACK_SLOP_PX = 32f
    }
}
