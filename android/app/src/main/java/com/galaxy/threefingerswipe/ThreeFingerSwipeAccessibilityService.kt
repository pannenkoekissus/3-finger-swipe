package com.galaxy.threefingerswipe

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.MotionEvent
import android.view.accessibility.AccessibilityEvent
import android.util.Log

/**
 * System-Wide 3-Finger Swipe Screenshot Accessibility Service
 * Optimized for Samsung Galaxy A57 5G & Android 14/15 One UI.
 */
class ThreeFingerSwipeAccessibilityService : AccessibilityService() {

    private lateinit var gestureDetector: GestureDetectorHelper
    private var vibrator: Vibrator? = null
    private var prefs: SharedPreferences? = null

    private var lastScreenshotTime: Long = 0

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "3-Finger Swipe Accessibility Service Connected!")

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        prefs = getSharedPreferences("swipe_settings", Context.MODE_PRIVATE)

        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.DEFAULT or
                    AccessibilityServiceInfo.FLAG_REQUEST_MULTI_FINGER_GESTURES or
                    AccessibilityServiceInfo.FLAG_SEND_MOTION_EVENTS
            notificationTimeout = 100
        }
        setServiceInfo(info)

        val threshold = prefs?.getInt("threshold_px", 200) ?: 200
        val dir = prefs?.getString("direction", "DOWN") ?: "DOWN"

        gestureDetector = GestureDetectorHelper(
            minSwipeDistancePx = threshold,
            direction = dir,
            onSwipeDetected = { triggerScreenshot() }
        )
    }

    override fun onMotionEvent(event: MotionEvent) {
        val isServiceActive = prefs?.getBoolean("service_active", true) ?: true
        if (!isServiceActive) {
            super.onMotionEvent(event)
            return
        }

        gestureDetector.processMotionEvent(event)
        super.onMotionEvent(event)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Not used for motion gesture handling
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility Service interrupted")
    }

    private fun triggerScreenshot() {
        val now = System.currentTimeMillis()
        val cooldownSec = prefs?.getFloat("cooldown_sec", 1.0f) ?: 1.0f
        val cooldownMs = (cooldownSec * 1000).toLong()

        if (now - lastScreenshotTime < cooldownMs) {
            Log.d(TAG, "Screenshot ignored: inside cooldown window")
            return
        }
        lastScreenshotTime = now

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
        } else {
            Log.e(TAG, "Screenshot action requires Android 9.0+")
        }
    }

    companion object {
        private const val TAG = "3FingerSwipeService"
    }
}
