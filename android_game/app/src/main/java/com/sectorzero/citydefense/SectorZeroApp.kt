package com.sectorzero.citydefense

import android.app.Application
import com.sectorzero.citydefense.di.AppContainer
import org.osmdroid.config.Configuration

class SectorZeroApp : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        // Configure OsmDroid user-agent & local tile cache for Esri World Imagery Satellite Maps
        Configuration.getInstance().userAgentValue = packageName
        container = AppContainer(applicationContext)
    }
}
