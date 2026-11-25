import { useState, useEffect, useCallback } from 'react';
import { parseGithubUrl, RepoIdentifier } from '../../lib/parseGithubUrl';

export function useActiveRepo() {
  const [repoInfo, setRepoInfo] = useState<RepoIdentifier | null>(null);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const updateFromTab = useCallback((tab?: chrome.tabs.Tab) => {
    if (!tab || !tab.url) {
      setRepoInfo(null);
      setActiveUrl(null);
      setLoading(false);
      return;
    }

    setActiveUrl(tab.url);
    const parsed = parseGithubUrl(tab.url);
    setRepoInfo(parsed);
    setLoading(false);
  }, []);

  const refreshActiveTab = useCallback(() => {
    if (typeof chrome === 'undefined' || !chrome.tabs || !chrome.tabs.query) {
      // Development or test environment fallback
      setLoading(false);
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs && tabs.length > 0 ? tabs[0] : undefined;
      updateFromTab(activeTab);
    });
  }, [updateFromTab]);

  useEffect(() => {
    refreshActiveTab();

    if (typeof chrome === 'undefined' || !chrome.tabs) {
      return;
    }

    // Tab switched
    const handleActivated = () => {
      refreshActiveTab();
    };

    // Tab URL changed (e.g. GitHub SPA navigation or page load)
    const handleUpdated = (
      _tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      if (tab.active && (changeInfo.url || changeInfo.status === 'complete')) {
        updateFromTab(tab);
      }
    };

    // Window focus changed
    const handleFocusChanged = (windowId: number) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        refreshActiveTab();
      }
    };

    chrome.tabs.onActivated.addListener(handleActivated);
    chrome.tabs.onUpdated.addListener(handleUpdated);
    chrome.windows.onFocusChanged.addListener(handleFocusChanged);

    return () => {
      chrome.tabs.onActivated.removeListener(handleActivated);
      chrome.tabs.onUpdated.removeListener(handleUpdated);
      chrome.windows.onFocusChanged.removeListener(handleFocusChanged);
    };
  }, [refreshActiveTab, updateFromTab]);

  return { repoInfo, activeUrl, loading, refreshActiveTab };
}
