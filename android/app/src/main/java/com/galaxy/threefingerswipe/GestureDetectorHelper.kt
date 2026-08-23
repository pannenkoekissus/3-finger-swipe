package com.galaxy.threefingerswipe

import android.view.MotionEvent
import kotlin.math.abs

/**
 * 3-Finger Touch Gesture Detector
 * Measures finger motion vectors when pointerCount == 3 to trigger screenshots.
 */
class GestureDetectorHelper(
    private var minSwipeDistancePx: Int = 200,
    private var direction: String = "DOWN",
    private val onSwipeDetected: () -> Unit
) {
    private var startY1 = 0f
    private var startY2 = 0f
    private var startY3 = 0f
    private var startX1 = 0f
    private var startX2 = 0f
    private var startX3 = 0f
    private var isTracking = false

    fun updateSettings(minDistance: Int, dir: String) {
        this.minSwipeDistancePx = minDistance
        this.direction = dir
    }

    fun processMotionEvent(event: MotionEvent) {
        when (event.actionMasked) {
            MotionEvent.ACTION_POINTER_DOWN -> {
                // Triggered when a 3rd finger touches down
                if (event.pointerCount == 3) {
                    startY1 = event.getY(0)
                    startY2 = event.getY(1)
                    startY3 = event.getY(2)
                    startX1 = event.getX(0)
                    startX2 = event.getX(1)
                    startX3 = event.getX(2)
                    isTracking = true
                }
            }

            MotionEvent.ACTION_MOVE -> {
                if (isTracking && event.pointerCount >= 3) {
                    val currentY1 = event.getY(0)
                    val currentY2 = event.getY(1)
                    val currentY3 = event.getY(2)
                    val currentX1 = event.getX(0)
                    val currentX2 = event.getX(1)
                    val currentX3 = event.getX(2)

                    val dy1 = currentY1 - startY1
                    val dy2 = currentY2 - startY2
                    val dy3 = currentY3 - startY3
                    val avgDy = (dy1 + dy2 + dy3) / 3f

                    val dx1 = currentX1 - startX1
                    val dx2 = currentX2 - startX2
                    val dx3 = currentX3 - startX3
                    val avgDx = (dx1 + dx2 + dx3) / 3f

                    val thresholdMet = when (direction.uppercase()) {
                        "DOWN" -> avgDy > minSwipeDistancePx
                        "UP" -> avgDy < -minSwipeDistancePx
                        "HORIZONTAL" -> abs(avgDx) > minSwipeDistancePx
                        else -> avgDy > minSwipeDistancePx
                    }

                    if (thresholdMet) {
                        isTracking = false // Prevent duplicate firing during same gesture
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
}
