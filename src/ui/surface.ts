import { useEffect, useState } from 'react';
import { rpc, type OpenIn, type WalletState } from '@/src/lib/rpc';

/**
 * Where the UI is rendered. The popup is capped at 600px tall by Chrome, so some screens use a
 * denser layout there; the side panel is as tall as the window and uses the handoff's full sizes.
 * Set statically on <html data-surface="panel"> in entrypoints/sidepanel/index.html.
 */
export type Surface = 'popup' | 'panel';

export const SURFACE: Surface = document.documentElement.dataset.surface === 'panel' ? 'panel' : 'popup';
export const IS_PANEL = SURFACE === 'panel';

/**
 * The current window id, resolved ahead of time: sidePanel.open() only works synchronously
 * inside a user gesture, so there's no time to look it up in the click handler.
 */
export function useWindowId() {
  const [windowId, setWindowId] = useState<number>();
  useEffect(() => {
    void browser.windows.getCurrent().then((w) => setWindowId(w.id));
  }, []);
  return windowId;
}

/**
 * Makes `target` the toolbar icon's surface and moves the wallet there right away:
 * popup → side panel opens the panel and closes the popup; side panel → popup opens the popup
 * and closes the panel. Must be called from a click handler (user gesture).
 */
export async function switchSurface(target: OpenIn, windowId: number | undefined): Promise<WalletState> {
  // Opening the panel has to happen before any await to keep the user gesture.
  const opening = target === 'panel' && !IS_PANEL && windowId !== undefined ? browser.sidePanel.open({ windowId }) : null;
  const state = await rpc('setOpenIn', { openIn: target });

  if (target === 'panel' && !IS_PANEL) {
    await opening;
    window.close(); // the popup
  } else if (target === 'popup' && IS_PANEL) {
    // The action now has a popup again; open it, then close this panel.
    await browser.action.openPopup(windowId !== undefined ? { windowId } : undefined).catch(() => undefined);
    try {
      if (windowId === undefined || !('close' in browser.sidePanel)) throw new Error('sidePanel.close unavailable');
      await browser.sidePanel.close({ windowId }); // Chrome 141+
    } catch {
      window.close();
    }
  }
  return state;
}
