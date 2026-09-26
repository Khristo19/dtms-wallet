import { applyOpenIn, handlers, onAlarm } from '@/src/background/service';
import { errorMessage } from '@/src/background/wallet';
import { RpcError, type RpcRequest, type RpcResponse } from '@/src/lib/rpc';

export default defineBackground(() => {
  browser.alarms.onAlarm.addListener((alarm) => onAlarm(alarm.name));
  void applyOpenIn().catch((e) => console.error('[dtms] applyOpenIn failed', e));

  browser.runtime.onMessage.addListener((msg: unknown, sender, sendResponse) => {
    const req = msg as RpcRequest;
    if (req?.type !== 'dtms-rpc') return false;

    // Only our own extension pages (popup / tab) may talk to the wallet.
    const origin = browser.runtime.getURL('/');
    if (sender.id !== browser.runtime.id || !sender.url?.startsWith(origin)) {
      sendResponse({ ok: false, error: 'Forbidden' } satisfies RpcResponse);
      return false;
    }

    const handler = handlers[req.method] as ((p: unknown) => Promise<unknown>) | undefined;
    if (!handler) {
      sendResponse({ ok: false, error: `Unknown method ${String(req.method)}` } satisfies RpcResponse);
      return false;
    }

    handler(req.params)
      .then((result) => sendResponse({ ok: true, result } satisfies RpcResponse))
      .catch((e: unknown) => {
        if (!(e instanceof RpcError)) console.error(`[dtms] ${req.method} failed`, e);
        sendResponse({ ok: false, error: errorMessage(e), code: e instanceof RpcError ? e.code : undefined } satisfies RpcResponse);
      });
    return true; // async response
  });
});
