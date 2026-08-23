/**
 * Android Source Code Repository for 3-Finger Swipe Screenshot App
 * Specific for Samsung Galaxy A57 5G & modern Android versions (API 28 - API 35+)
 */

const ANDROID_SOURCES = {
    service: `package com.galaxy.threefingerswipe

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
 * 
 * Optimized for Samsung Galaxy A57 5G (Android 14/15 One UI 6.1/7.0).
 * Intercepts touch gestures across all apps and home screen without root.
 */
class ThreeFingerSwipeAccessibilityService : AccessibilityService() {

    private lateinit var gestureDetector: GestureDetectorHelper
    private var vibrator: Vibrator? = null
    private var prefs: SharedPreferences? = null

    private var lastScreenshotTime: Long = 0
    private var cooldownMs: Long = 1000

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.i(TAG, "3-Finger Swipe Accessibility Service Connected!")

        vibrator = getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
        prefs = getSharedPreferences("swipe_settings", Context.MODE_PRIVATE)

        val info = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            flags = AccessibilityServiceInfo.FLAG_DEFAULT or
                    AccessibilityServiceInfo.FLAG_REQUEST_MULTI_FINGER_GESTURES or
                    AccessibilityServiceInfo.FLAG_SEND_MOTION_EVENTS
            notificationTimeout = 100
        }
        setServiceInfo(info)

        // Initialize helper with threshold & direction
        gestureDetector = GestureDetectorHelper(
            minSwipeDistancePx = prefs?.getInt("threshold_px", 200) ?: 200,
            direction = prefs?.getString("direction", "DOWN") ?: "DOWN",
            onSwipeDetected = { triggerScreenshot() }
        )
    }

    /**
     * Intercept system touch motion events for multi-finger touch tracking
     */
    override fun onMotionEvent(event: MotionEvent) {
        val isServiceActive = prefs?.getBoolean("service_active", true) ?: true
        if (!isServiceActive) {
            super.onMotionEvent(event)
            return
        }

        // Pass motion event to 3-finger gesture logic
        gestureDetector.processMotionEvent(event)
        super.onMotionEvent(event)
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Accessibility events (not required for motion gesture, kept for service lifecycle)
    }

    override fun onInterrupt() {
        Log.w(TAG, "Service interrupted")
    }

    /**
     * Triggers standard Android system screenshot action
     */
    private fun triggerScreenshot() {
        val now = System.currentTimeMillis()
        cooldownMs = (prefs?.getFloat("cooldown_sec", 1.0f) ?: 1.0f * 1000).toLong()

        if (now - lastScreenshotTime < cooldownMs) {
            Log.d(TAG, "Screenshot ignored due to cooldown")
            return
        }
        lastScreenshotTime = now

        // Perform Vibration Feedback
        if (prefs?.getBoolean("vibration_enabled", true) != false) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                vibrator?.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK))
            } else {
                @Suppress("DEPRECATION")
                vibrator?.vibrate(50)
            }
        }

        // Trigger system screenshot (API 28+ native global action)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            val success = performGlobalAction(GLOBAL_ACTION_TAKE_SCREENSHOT)
            Log.i(TAG, "Global Take Screenshot action executed: success=$success")
        } else {
            Log.e(TAG, "Global screenshot requires Android 9.0 (API 28)+")
        }
    }

    companion object {
        private const val TAG = "3FingerSwipeService"
    }
}`,

    detector: `package com.galaxy.threefingerswipe

import android.view.MotionEvent
import kotlin.math.abs

/**
 * 3-Finger Gesture Detector
 * Tracks initial pointer positions when pointerCount == 3 and measures swipe deltas.
 */
class GestureDetectorHelper(
    private var minSwipeDistancePx: Int = 200,
    private var direction: String = "DOWN",
    private val onSwipeDetected: () -> Unit
) {
    private var startY1 = 0f
    private var startY2 = 0f
    private var startY3 = 0f
    private var isTracking = false

    fun updateSettings(minDistance: Int, dir: String) {
        this.minSwipeDistancePx = minDistance
        this.direction = dir
    }

    fun processMotionEvent(event: MotionEvent) {
        when (event.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> {
                // When 3 fingers touch down on screen
                if (event.pointerCount == 3) {
                    startY1 = event.getY(0)
                    startY2 = event.getY(1)
                    startY3 = event.getY(2)
                    isTracking = true
                }
            }

            MotionEvent.ACTION_MOVE -> {
                if (isTracking && event.pointerCount == 3) {
                    val currentY1 = event.getY(0)
                    val currentY2 = event.getY(1)
                    val currentY3 = event.getY(2)

                    val dy1 = currentY1 - startY1
                    val dy2 = currentY2 - startY2
                    val dy3 = currentY3 - startY3

                    val avgDy = (dy1 + dy2 + dy3) / 3f

                    val thresholdMet = when (direction) {
                        "DOWN" -> avgDy > minSwipeDistancePx
                        "UP" -> avgDy < -minSwipeDistancePx
                        else -> abs(avgDy) > minSwipeDistancePx
                    }

                    if (thresholdMet) {
                        isTracking = false // Reset tracking for this gesture sequence
                        onSwipeDetected()
                    }
                }
            }

            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL, MotionEvent.ACTION_POINTER_UP -> {
                if (event.pointerCount < 3) {
                    isTracking = false
                }
            }
        }
    }
}`,

    manifest: `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.galaxy.threefingerswipe">

    <!-- Permissions for vibration and accessibility -->
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />

    <application
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:label="3-Finger Swipe Screenshot"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.ThreeFingerSwipe">

        <!-- Main Dashboard Activity -->
        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:label="3-Finger Screenshot"
            android:theme="@style/Theme.ThreeFingerSwipe">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <!-- System Accessibility Service for Gesture Detection -->
        <service
            android:name=".ThreeFingerSwipeAccessibilityService"
            android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE"
            android:exported="true"
            android:label="3-Finger Swipe Screenshot Service">
            <intent-filter>
                <action android:name="android.accessibilityservice.AccessibilityService" />
            </intent-filter>
            <meta-data
                android:name="android.accessibilityservice"
                android:resource="@xml/accessibility_service_config" />
        </service>

    </application>

</manifest>`,

    config: `<?xml version="1.0" encoding="utf-8"?>
<accessibility-service xmlns:android="http://schemas.android.com/apk/res/android"
    android:accessibilityEventTypes="typeAllMask"
    android:accessibilityFeedbackType="feedbackGeneric"
    android:accessibilityFlags="flagDefault|flagRequestMultiFingerGestures|flagSendMotionEvents"
    android:canPerformGestures="true"
    android:canRequestTouchExplorationMode="true"
    android:canRetrieveWindowContent="false"
    android:description="@string/accessibility_service_description"
    android:notificationTimeout="100" />`,

    ui: `package com.galaxy.threefingerswipe

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    DashboardScreen(
                        onOpenAccessibilitySettings = {
                            startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun DashboardScreen(onOpenAccessibilitySettings: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text(
            text = "3-Finger Swipe Screenshot",
            style = MaterialTheme.typography.headlineMedium
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "Optimized for Samsung Galaxy A57 5G",
            style = MaterialTheme.typography.bodyMedium
        )
        Spacer(modifier = Modifier.height(32.dp))
        Button(
            onClick = onOpenAccessibilitySettings,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Enable Accessibility Service")
        }
    }
}`
};
