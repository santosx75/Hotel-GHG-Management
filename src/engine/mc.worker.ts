/// <reference lib="webworker" />
import { monteCarlo } from './sensitivity';

// Monte Carlo runs off the main thread so the UI never blocks.
self.onmessage = (e: MessageEvent) => {
  const { inputs, settings, library, n, seed, calibration } = e.data;
  try {
    const r = monteCarlo(inputs, settings, library, n, seed, calibration);
    (self as unknown as Worker).postMessage({ ok: true, result: r });
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(err) });
  }
};
