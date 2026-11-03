package com.screenbuddy

import android.app.AlertDialog
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.facebook.react.modules.core.DeviceEventManagerModule

class PointerOverlayService : Service() {
    private lateinit var windowManager: WindowManager
    
    private lateinit var pointerView: View
    private lateinit var pointerParams: WindowManager.LayoutParams
    
    private lateinit var stopButtonView: TextView
    private lateinit var stopButtonParams: WindowManager.LayoutParams

    // Variables to track dragging math
    private var initialX: Int = 0
    private var initialY: Int = 0
    private var initialTouchX: Float = 0f
    private var initialTouchY: Float = 0f
    private var isDragging: Boolean = false

    companion object {
        var instance: PointerOverlayService? = null
        private const val CHANNEL_ID = "screenbuddy_overlay"
        private const val NOTIFICATION_ID = 1001
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        instance = this
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager

        // Start as a foreground service immediately (required for Android 8+)
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, createNotification())

        val layoutFlag = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            WindowManager.LayoutParams.TYPE_PHONE
        }

        // --- 1. SETUP THE RED DOT ---
        pointerView = View(this).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#99FF3B30")) 
                setStroke(5, Color.WHITE)
            }
            visibility = View.GONE
        }

        pointerParams = WindowManager.LayoutParams(
            100, 100, layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START 
            x = 0
            y = 0
        }

        // --- 2. SETUP THE BEAUTIFUL DRAGGABLE STOP BUTTON ---
        stopButtonView = TextView(this).apply {
            text = "Stop"
            textSize = 16f
            typeface = android.graphics.Typeface.DEFAULT_BOLD
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#E74C3C"))
                setStroke(6, Color.WHITE)
            }
            
            setOnTouchListener { _, event ->
                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        initialX = stopButtonParams.x
                        initialY = stopButtonParams.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isDragging = false
                        true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val deltaX = (event.rawX - initialTouchX).toInt()
                        val deltaY = (event.rawY - initialTouchY).toInt()
                        
                        if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                            isDragging = true
                        }
                        
                        stopButtonParams.x = initialX + deltaX
                        stopButtonParams.y = initialY + deltaY
                        windowManager.updateViewLayout(stopButtonView, stopButtonParams)
                        true
                    }
                    MotionEvent.ACTION_UP -> {
                        if (!isDragging) {
                            showConfirmationDialog()
                        }
                        true
                    }
                    else -> false
                }
            }
        }

        stopButtonParams = WindowManager.LayoutParams(
            140, 140, layoutFlag,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = resources.displayMetrics.widthPixels - 180
            y = 200
        }

        windowManager.addView(pointerView, pointerParams)
        windowManager.addView(stopButtonView, stopButtonParams)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Screen Sharing",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shows when ScreenBuddy is sharing your screen"
                setShowBadge(false)
            }
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        // Create a "Stop Sharing" action that taps through to triggerReactNativeStop
        val stopIntent = Intent(this, PointerOverlayService::class.java).apply {
            action = "STOP_SHARING"
        }
        val stopPendingIntent = PendingIntent.getService(
            this, 0, stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // "Open App" action
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)
        val openPendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_share)
            .setContentTitle("ScreenBuddy is sharing your screen")
            .setContentText("Your helper can see your screen. Tap to open the app.")
            .setContentIntent(openPendingIntent)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop Sharing", stopPendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP_SHARING") {
            triggerReactNativeStop()
            return START_NOT_STICKY
        }
        return START_STICKY
    }

    private fun showConfirmationDialog() {
        val dialog = AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
            .setTitle("Stop Sharing?")
            .setMessage("Are you sure you want to stop sharing your screen with your helper?")
            .setPositiveButton("Yes, Stop") { _, _ ->
                triggerReactNativeStop()
            }
            .setNegativeButton("Cancel", null)
            .create()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
        } else {
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
        }
        
        dialog.show()
    }

    private fun triggerReactNativeStop() {
        PointerModule.reactContextInstance
            ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            ?.emit("onStopSharing", null)
            
        stopSelf()
    }

    fun updatePosition(x: Int, y: Int) {
        if (pointerView.visibility != View.VISIBLE) pointerView.visibility = View.VISIBLE
        pointerParams.x = x - 50
        pointerParams.y = y - 50
        windowManager.updateViewLayout(pointerView, pointerParams)
    }

    fun hidePointer() {
        if (pointerView.visibility != View.GONE) {
            pointerView.visibility = View.GONE
            windowManager.updateViewLayout(pointerView, pointerParams)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::pointerView.isInitialized) windowManager.removeView(pointerView)
        if (::stopButtonView.isInitialized) windowManager.removeView(stopButtonView)
        instance = null
    }
}