---
name: gmp-framework-flutter
description: This skill provides the architectural foundation and implementation best practices for developing Google Maps Platform applications using Flutter and the `google_maps_flutter` package. It focuses on the declarative nature of the Flutter SDK, managing map state and objects through widget properties, and handling asynchronous operations via `GoogleMapController`.
license: Apache-2.0
metadata:
  version: 1.0.53
---

> [!IMPORTANT] **Core Dependency:** This skill requires active context from
> [google-maps-platform/SKILL.md](https://www.gstatic.com/googlemapsplatform-agent-skills/google-maps-platform/SKILL.md).

## Flutter Architectural Guidelines (`google_maps_flutter`)

The Flutter SDK utilizes a declarative approach to map configuration. All map
features (markers, polygons, camera position, controls) are passed as properties
to the `GoogleMap` widget. Updating the map requires managing the state of these
properties within a `StatefulWidget` and calling `setState()`.

### 1. Core Component Structure

The `GoogleMap` widget is the central component. Since map interaction often
relies on an initialized controller, the typical pattern involves a
`StatefulWidget` and utilizing a `Completer` to manage the asynchronous
initialization of the `GoogleMapController`.

Functionality         | Flutter Implementation                                                       | Notes
:-------------------- | :--------------------------------------------------------------------------- | :----
**Map Display**       | `GoogleMap` widget                                                           | Requires `initialCameraPosition`.
**Controller Access** | `onMapCreated: (controller) => _completer.complete(controller)`              | Use a `Completer<GoogleMapController>` to access controller methods (`animateCamera`, `moveCamera`, etc.) asynchronously.
**Map Objects**       | `markers: Set<Marker>`, `polylines: Set<Polyline>`, `polygons: Set<Polygon>` | Pass sets directly to the widget. Update objects via `setState()`.
**Styling**           | `cloudMapId` or `style`                                                      | Cloud-based maps must use a `cloudMapId` property. Custom JSON styling can use the `style` string property.
**Interactions**      | `onTap`, `onLongPress`                                                       | Defined as callbacks on the `GoogleMap` widget or individual marker objects.

### 2. State Management and Dynamic Updates

To perform operations like adding markers dynamically or changing map
configuration at runtime, encapsulate the map within a `StatefulWidget`.

**2.1. Dynamic Map Objects (Markers)**

Map objects are managed by updating the `Set` supplied to the `GoogleMap` widget
within `setState()`.

```dart
// Source: Google Maps Platform Code Assist
class DynamicMarkerSample extends StatefulWidget {
  // ... constructor
}

class _DynamicMarkerSampleState extends State<DynamicMarkerSample> {
  // 1. Define the mutable set of objects
  final Set<Marker> _markers = {
    Marker(markerId: MarkerId('initial_marker'), position: LatLng(37.7908, -122.4058)),
  };

  @override
  Widget build(BuildContext context) {
    return GoogleMap(
      initialCameraPosition: CameraPosition(target: LatLng(37.7749, -122.4194), zoom: 12.5),
      markers: _markers, // 2. Pass the set declaratively
      // ...
    );
  }

  void _addMarker() {
    const newMarker = Marker(
      markerId: MarkerId('new_marker'),
      position: LatLng(37.8080, -122.4177),
    );

    // 3. Update state to redraw the map
    setState(() => _markers.add(newMarker));
  }
}
```

**2.2. Dynamic Camera Control**

Camera movements require the `GoogleMapController`.

```dart
// Source: Google Maps Platform Code Assist
// Example of animating the camera position.
void _onPressed() {
  if (_controller == null) return;

  final newYork = CameraPosition(
    target: LatLng(40.7128, -74.0060),
    bearing: 270,
    tilt: 30,
    zoom: 18,
  );
  final update = CameraUpdate.newCameraPosition(newYork);

  // Use animateCamera for smooth movement or moveCamera for instantaneous jump.
  _controller?.animateCamera(update);
}
```

### 3. Advanced Features

**3.1. Marker Clustering**

Clustering requires the definition of a `ClusterManager` and assigning its
`clusterManagerId` to the relevant markers.

```dart
// Source: Google Maps Platform Code Assist
final ClusterManager _myCluster = ClusterManager(
  clusterManagerId: ClusterManagerId('my_cluster_id'),
);

@override
Widget build(BuildContext context) {
  return GoogleMap(
    initialCameraPosition: CameraPosition(target: LatLng(0, 0)),
    clusterManagers: {_myCluster}, // Declare the cluster manager
    markers: {
      Marker(
        markerId: MarkerId('marker_1'),
        position: LatLng(6.51, 3.37),
        // Assign the marker to the cluster
        clusterManagerId: _myCluster.clusterManagerId,
      ),
      // ... other markers
    },
  );
}
```

**3.2. Customizing Markers**

Custom icons are loaded asynchronously using `BitmapDescriptor`.

```dart
// Source: Google Maps Platform Code Assist
void _changeIcon() async {
  // 1. Create the configuration (important for scaling)
  final imageConfiguration = createLocalImageConfiguration(
    context,
    size: Size(42, 52),
  );

  // 2. Load the asset
  final assetIcon = await BitmapDescriptor.asset(
    imageConfiguration,
    'assets/icon_flutter.png',
  );

  setState(() {
    // 3. Update the marker state
    _marker = _marker.copyWith(
      iconParam: assetIcon,
      anchorParam: const Offset(0.5, 0.5),
    );
  });
}
```

### 4. Event Handling and Asynchronous Control

Accessing map properties or performing actions like zoom require the
asynchronous `GoogleMapController`.

```dart
// Source: Google Maps Platform Code Assist
class _MapControllerAsyncSampleState extends State<MapControllerAsyncSample> {
  final Completer<GoogleMapController> _completer = Completer();
  // ... (setup and lifecycle methods)

  @override
  Widget build(BuildContext context) {
    return GoogleMap(
      // ... initial config
      onMapCreated: (controller) => _completer.complete(controller), // Fulfill the Completer
    );
  }

  void _onOutsideEvent() async {
    // Wait for the controller to be ready
    final controller = await _completer.future;

    // Execute map function
    controller.animateCamera(CameraUpdate.zoomIn());
  }
}
```

## Gotchas (Flutter Specific)

### G1. Scrolling and Gesture Conflicts

When embedding `GoogleMap` inside a scrollable widget (like `ListView` or
`SingleChildScrollView`), the parent widget may intercept horizontal or vertical
drag gestures, preventing the user from panning the map.

**Mandatory Fix:** Explicitly pass `gestureRecognizers` to the `GoogleMap`
widget to claim the required gestures. Use `EagerGestureRecognizer` to ensure
the map takes precedence.

```dart
// Source: Google Maps Platform Code Assist
GoogleMap(
  initialCameraPosition: CameraPosition(target: LatLng(0, 0)),
  gestureRecognizers: {
    // Claim all gestures to ensure smooth map interaction,
    // overriding the parent ListView.
    Factory(() => EagerGestureRecognizer()),
  },
  // ...
)
```

### G2. Controller Completer Safety

If the `GoogleMap` widget is recreated (e.g., due to a key change) and calls
`onMapCreated` again, attempting to complete an already completed `Completer`
will result in a runtime error. Ensure that in complex state management
scenarios, the `Completer` is managed safely or recreated only if necessary.

### G3. My Location Layer (Permissions)

Setting `myLocationEnabled: true` merely enables the visual layer in the
GoogleMap SDK. It **does not** handle the necessary platform-specific runtime
location permissions (e.g., on Android and iOS). The developer must use external
Flutter packages (like `permission_handler` or `geolocator`) to explicitly
request and confirm location permission *before* the map is built.

### G4. Clustering on Web

For `ClusterManager` functionality to work correctly when deploying to the web
platform, an additional JavaScript library must be imported manually into the
main HTML file, as detailed in the `google_maps_flutter_web` package
documentation.

--------------------------------------------------------------------------------

## References

-   https://github.com/googlemaps-samples/flutter-maps-samples

## 🚀 Master Orchestration Integration Workflow

Follow this multi-phase sequential integration checklist to compose features
robustly. For each phase, satisfy its *Verification Checkpoint* before
advancing.

### 📦 Phase 1: Core Initialization & Base Setup (Primary)

-   [ ] **Step 1.1: Plugin Binding & GoogleMap Widget Setup** *Trigger
    Condition*: Always active during the root view layout boilerplate setup.
    *Verification Checkpoint*: Ensure the `GoogleMap` widget is correctly
    instantiated with an explicit initial `CameraPosition` camera viewport
    location target.

### 📦 Phase 2: Component Integration & Feature Layers (Supplemental)

-   [ ] **Step 2.1: Interactive Markers & Overlays Composition** *Trigger
    Condition*: Triggered when user application specifications dictate adding
    geographic markers map pins overlays. *Verification Checkpoint*: Ensure the
    markers collection set object is dynamically populated and bound to the
    widget's `markers` parameter layer.
