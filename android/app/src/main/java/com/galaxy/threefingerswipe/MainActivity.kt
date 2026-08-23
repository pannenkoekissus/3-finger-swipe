package com.galaxy.threefingerswipe

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.text.TextUtils
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = Color(0xFF0B0D17)
                ) {
                    MainDashboardScreen()
                }
            }
        }
    }
}

@Composable
fun AppTheme(content: @Composable () -> Unit) {
    val darkColors = darkColorScheme(
        primary = Color(0xFF8B5CF6),
        secondary = Color(0xFF6366F1),
        background = Color(0xFF0B0D17),
        surface = Color(0xFF161B2E),
        onPrimary = Color.White,
        onBackground = Color(0xFFF3F4F6),
        onSurface = Color(0xFFF3F4F6)
    )
    MaterialTheme(colorScheme = darkColors, content = content)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainDashboardScreen() {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("swipe_settings", Context.MODE_PRIVATE) }

    var isServiceEnabled by remember { mutableStateOf(isAccessibilityServiceEnabled(context)) }
    var isServiceActive by remember { mutableStateOf(prefs.getBoolean("service_active", true)) }
    var direction by remember { mutableStateOf(prefs.getString("direction", "DOWN") ?: "DOWN") }
    var sensitivityPx by remember { mutableFloatStateOf((prefs.getInt("threshold_px", 200)).toFloat()) }
    var cooldownSec by remember { mutableFloatStateOf(prefs.getFloat("cooldown_sec", 1.0f)) }
    var vibrationEnabled by remember { mutableStateOf(prefs.getBoolean("vibration_enabled", true)) }

    // Re-check service status on resume
    LaunchedEffect(Unit) {
        isServiceEnabled = isAccessibilityServiceEnabled(context)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Header Title
        Text(
            text = "3-Finger Swipe Screenshot",
            fontSize = 24.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )
        Text(
            text = "Optimized for Samsung Galaxy A57 5G (One UI 6/7)",
            fontSize = 13.sp,
            color = Color(0xFF9CA3AF)
        )

        Spacer(modifier = Modifier.height(4.dp))

        // Service Status Banner
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (isServiceEnabled) Color(0xFF10B981).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f)
            ),
            modifier = Modifier.fillMaxWidth()
        ) {
            Row(
                modifier = Modifier.padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Icon(
                    imageVector = if (isServiceEnabled) Icons.Default.CheckCircle else Icons.Default.Warning,
                    contentDescription = null,
                    tint = if (isServiceEnabled) Color(0xFF10B981) else Color(0xFFEF4444),
                    modifier = Modifier.size(32.dp)
                )
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = if (isServiceEnabled) "Accessibility Service Active" else "Accessibility Service Disabled",
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                        fontSize = 16.sp
                    )
                    Text(
                        text = if (isServiceEnabled) "Ready to capture screenshots with 3-finger swipe" else "Tap below to enable system-wide accessibility service",
                        fontSize = 12.sp,
                        color = Color(0xFF9CA3AF)
                    )
                }
            }
        }

        // Action Button: Enable Accessibility
        Button(
            onClick = {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                context.startActivity(intent)
            },
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF8B5CF6)),
            modifier = Modifier.fillMaxWidth().height(50.dp)
        ) {
            Icon(Icons.Default.Settings, contentDescription = null)
            Spacer(modifier = Modifier.width(8.dp))
            Text("Open Accessibility Settings", fontWeight = FontWeight.SemiBold)
        }

        // Action Button: Battery Optimization Exemption (Crucial for Samsung One UI)
        OutlinedButton(
            onClick = {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${context.packageName}")
                    }
                    context.startActivity(intent)
                }
            },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Disable Samsung Battery Saver for App", color = Color(0xFFC4B5FD))
        }

        Divider(color = Color(0xFF252B42), thickness = 1.dp, modifier = Modifier.padding(vertical = 8.dp))

        // Settings Section
        Text(
            text = "Gesture Preferences",
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            color = Color.White
        )

        // Direction Selector
        Text("Gesture Direction: $direction", fontSize = 14.sp, color = Color(0xFF9CA3AF))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("DOWN", "UP", "HORIZONTAL").forEach { dir ->
                FilterChip(
                    selected = direction == dir,
                    onClick = {
                        direction = dir
                        prefs.edit().putString("direction", dir).apply()
                    },
                    label = { Text("Swipe $dir") }
                )
            }
        }

        // Sensitivity Slider
        Text("Sensitivity Threshold: ${sensitivityPx.toInt()} px", fontSize = 14.sp, color = Color(0xFF9CA3AF))
        Slider(
            value = sensitivityPx,
            onValueChange = {
                sensitivityPx = it
                prefs.edit().putInt("threshold_px", it.toInt()).apply()
            },
            valueRange = 80f..400f
        )

        // Cooldown Slider
        Text("Capture Cooldown: ${"%.1f".format(cooldownSec)} sec", fontSize = 14.sp, color = Color(0xFF9CA3AF))
        Slider(
            value = cooldownSec,
            onValueChange = {
                cooldownSec = it
                prefs.edit().putFloat("cooldown_sec", it).apply()
            },
            valueRange = 0.5f..3.0f
        )

        // Vibration Switch
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("Vibration Feedback", color = Color.White)
            Switch(
                checked = vibrationEnabled,
                onCheckedChange = {
                    vibrationEnabled = it
                    prefs.edit().putBoolean("vibration_enabled", it).apply()
                }
            )
        }
    }
}

private fun isAccessibilityServiceEnabled(context: Context): Boolean {
    val service = "${context.packageName}/${ThreeFingerSwipeAccessibilityService::class.java.canonicalName}"
    val accessibilityEnabled = try {
        Settings.Secure.getInt(context.contentResolver, Settings.Secure.ACCESSIBILITY_ENABLED)
    } catch (e: Exception) {
        0
    }
    if (accessibilityEnabled == 1) {
        val settingValue = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        )
        if (settingValue != null) {
            val splitter = TextUtils.SimpleStringSplitter(':')
            splitter.setString(settingValue)
            while (splitter.hasNext()) {
                if (splitter.next().equals(service, ignoreCase = true)) {
                    return true
                }
            }
        }
    }
    return false
}
