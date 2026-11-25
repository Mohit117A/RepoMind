/**
 * RepoMind Extension Background Service Worker
 *
 * Configures the extension toolbar icon to open the Chrome side panel when clicked.
 * The panel opens ONLY on click, never automatically.
 */

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error: unknown) => {
    console.error('[RepoMind Background] Failed to set openPanelOnActionClick:', error);
  });
