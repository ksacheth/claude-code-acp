import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

/// Notify only when the user is working elsewhere; showing native banners while
/// they are already looking at the app is distracting.
export async function notifyWhenUnfocused(title: string, body: string): Promise<void> {
  if (document.hasFocus()) return;

  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) sendNotification({ title, body });
  } catch (error) {
    // Notifications are a convenience. A denied OS permission must never
    // interrupt a conversation or leave an ACP request unresolved.
    console.warn("[claude-tauri] could not send notification:", error);
  }
}
