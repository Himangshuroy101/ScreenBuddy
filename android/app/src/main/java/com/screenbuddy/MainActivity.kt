package com.screenbuddy

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

// 1. Add this import at the top
import com.oney.WebRTCModule.WebRTCModuleOptions

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "ScreenBuddy"

  // 2. Override onCreate to enable the projection service
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    
    // Enable the built-in screen capture foreground service
    val options = WebRTCModuleOptions.getInstance()
    options.enableMediaProjectionService = true
  }

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}