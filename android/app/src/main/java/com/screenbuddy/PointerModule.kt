package com.screenbuddy

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class PointerModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    // We use a companion object to expose the context to our Service
    companion object {
        var reactContextInstance: ReactApplicationContext? = null
    }

    init {
        reactContextInstance = reactContext
    }

    override fun getName(): String = "PointerOverlay"

    @ReactMethod
    fun requestOverlayPermission(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(reactContext)) {
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${reactContext.packageName}"))
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactContext.startActivity(intent)
            promise.resolve(false)
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun startOverlay() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && Settings.canDrawOverlays(reactContext)) {
            val intent = Intent(reactContext, PointerOverlayService::class.java)
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun updatePointer(x: Double, y: Double) {
        val displayMetrics = reactContext.resources.displayMetrics
        val pixelX = (x * displayMetrics.widthPixels).toInt()
        val pixelY = (y * displayMetrics.heightPixels).toInt()

        reactContext.runOnUiQueueThread {
            PointerOverlayService.instance?.updatePosition(pixelX, pixelY)
        }
    }

    @ReactMethod
    fun hidePointer() {
        reactContext.runOnUiQueueThread {
            PointerOverlayService.instance?.hidePointer()
        }
    }

    @ReactMethod
    fun stopOverlay() {
        val intent = Intent(reactContext, PointerOverlayService::class.java)
        reactContext.stopService(intent)
    }

    // React Native requires this method to be present for EventEmitters
    @ReactMethod
    fun addListener(eventName: String) {}

    // React Native requires this method to be present for EventEmitters
    @ReactMethod
    fun removeListeners(count: Int) {}
}