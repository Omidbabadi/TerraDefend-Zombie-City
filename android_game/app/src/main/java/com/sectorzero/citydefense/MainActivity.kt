package com.sectorzero.citydefense

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sectorzero.citydefense.presentation.ui.AndroidGameScreen
import com.sectorzero.citydefense.presentation.viewmodel.AndroidGameViewModel
import com.sectorzero.citydefense.presentation.viewmodel.AndroidGameViewModelFactory

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Enable Android Immersive Sticky Game Mode (edge-to-edge fullscreen without status/nav bars)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowInsetsControllerCompat(window, window.decorView).let { controller ->
            controller.hide(WindowInsetsCompat.Type.systemBars())
            controller.systemBarsBehavior =
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }

        val appContainer = (application as SectorZeroApp).container

        setContent {
            val gameViewModel: AndroidGameViewModel = viewModel(
                factory = AndroidGameViewModelFactory(appContainer)
            )
            AndroidGameScreen(viewModel = gameViewModel)
        }
    }
}
