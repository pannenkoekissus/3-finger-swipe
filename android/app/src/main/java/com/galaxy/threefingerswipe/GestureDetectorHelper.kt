package com.galaxy.threefingerswipe

import android.view.MotionEvent
import kotlin.math.abs

/**
 * Robust 3-Finger Touch Gesture Detector
 * Tracks initial touch positions when pointerCount >= 3 and detects swipe direction vectors.
 */
class GestureDetectorHelper(
    private var minSwipeDistancePx: Int = 120,
    private var direction: String = "DOWN",
    private val onSwipeDetected: () -> Unit,
    private val onFingersDetected: (() -> Unit)? = null
) {
    private var startY = 0f
    private var startX = 0f
    private var isTracking = false

    fun updateSettings(minDistance: Int, dir: String) {
        this.minSwipeDistancePx = minDistance
        this.direction = dir
    }

    fun processMotionEvent(event: MotionEvent) {
        val pointerCount = event.pointerCount

        if (pointerCount >= 3) {
            // Calculate average X and Y of the first 3 active pointers
            val currentAvgY = (event.getY(0) + event.getY(1) + event.getY(2)) / 3f
            val currentAvgX = (event.getX(0) + event.getX(1) + event.getX(2)) / 3f

            if (!isTracking) {
                // Initialize gesture origin when 3 fingers are first detected
                startY = currentAvgY
                startX = currentAvgX
                isTracking = true
                onFingersDetected?.invoke()
            } else {
                // Measure movement displacement delta
                val dy = currentAvgY - startY
                val dx = currentAvgX - startX

                val thresholdMet = when (direction.uppercase()) {
                    "DOWN" -> dy > minSwipeDistancePx
                    "UP" -> dy < -minSwipeDistancePx
                    "HORIZONTAL" -> abs(dx) > minSwipeDistancePx
                    else -> dy > minSwipeDistancePx
                }

                if (thresholdMet) {
                    isTracking = false // Prevent duplicate triggers during same swipe
                    onSwipeDetected()
                }
            }
        } else {
            // Reset when fewer than 3 fingers touch screen
            isTracking = false
        }
    }
}
