package com.sectorzero.citydefense.presentation.ui

import android.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.sectorzero.citydefense.domain.model.CitySector
import org.osmdroid.tileprovider.tilesource.XYTileSource
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Polyline

private val EsriWorldImagerySatelliteSource = XYTileSource(
    "EsriWorldImagery",
    1,
    19,
    256,
    ".jpg",
    arrayOf("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/")
)

/**
 * Renders the whole city on Esri World Imagery Satellite tiles via OsmDroid MapView,
 * highlighting real OSRM road corridors where Units & Zombies operate.
 */
@Composable
fun SatelliteMapComposable(
    sector: CitySector?,
    modifier: Modifier = Modifier
) {
    if (sector == null) return

    AndroidView(
        modifier = modifier,
        factory = { context ->
            MapView(context).apply {
                setTileSource(EsriWorldImagerySatelliteSource)
                setMultiTouchControls(false)
                controller.setZoom(sector.zoom)
                controller.setCenter(GeoPoint(sector.centerLat, sector.centerLng))
            }
        },
        update = { mapView ->
            mapView.controller.setZoom(sector.zoom)
            mapView.controller.setCenter(GeoPoint(sector.centerLat, sector.centerLng))
            mapView.overlays.clear()

            sector.roads.forEach { corridor ->
                val gpsPts = corridor.waypoints.mapNotNull { wp ->
                    val lat = wp.latitude
                    val lng = wp.longitude
                    if (lat != null && lng != null) GeoPoint(lat, lng) else null
                }
                if (gpsPts.size >= 2) {
                    val poly = Polyline().apply {
                        setPoints(gpsPts)
                        outlinePaint.color = Color.argb(190, 245, 158, 11)
                        outlinePaint.strokeWidth = 7f
                    }
                    mapView.overlays.add(poly)
                }
            }
            mapView.invalidate()
        }
    )
}
