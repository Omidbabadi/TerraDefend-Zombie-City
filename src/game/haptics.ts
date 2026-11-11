export type AndroidHapticKind = 'tap' | 'deploy' | 'command' | 'error' | 'explosion';

/**
 * Triggers Android hardware tactile feedback via the Vibration API when supported on Android devices.
 * Gracefully no-ops on desktop or browsers without vibration hardware.
 */
export function triggerAndroidHaptic(kind: AndroidHapticKind): void {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
    return;
  }
  try {
    switch (kind) {
      case 'tap':
        navigator.vibrate(10);
        break;
      case 'deploy':
        navigator.vibrate(22);
        break;
      case 'command':
        navigator.vibrate([18, 28, 24]);
        break;
      case 'error':
        navigator.vibrate([30, 40, 30]);
        break;
      case 'explosion':
        navigator.vibrate([45, 25, 65]);
        break;
    }
  } catch {
    // Ignore vibration errors in restricted contexts
  }
}
