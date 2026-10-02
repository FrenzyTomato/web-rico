import { BUILDING_MODEL, ESTATE_MODEL, GOODS_MODEL } from './modelCatalog.js';

// Cache compressed bytes, not a second WebGL scene. Lobby and renderer share in-flight requests.
const downloads = new Map<string, Promise<ArrayBuffer>>();
export function modelUrl(name: string, folder: string) {
  return `/art/${folder}/${encodeURIComponent(name)}.glb.gz`;
}
export function downloadModel(url: string): Promise<ArrayBuffer> {
  let pending = downloads.get(url);
  if (!pending) {
    pending = fetch(url).then(response => {
      if (!response.ok) throw Error(`Model unavailable: ${url}`);
      return response.arrayBuffer();
    }).catch(error => { downloads.delete(url); throw error; });
    downloads.set(url, pending);
  }
  return pending;
}

export const BOARD_MODELS = [...new Set([
  ...Object.values(ESTATE_MODEL), ...Object.values(BUILDING_MODEL), ...Object.values(GOODS_MODEL),
  ...[4, 5, 6, 7, 8].map(n => `${n}-Slot Boat`), 'Trader Depot', 'Private Boat',
  ...[1, 2, 3, 4, 5].map(n => `Worker ${String(n).padStart(2, '0')}`),
])];
const preloads = new Map<string, Promise<void>>();
/** Two background downloads at a time; failures retry normally when the board needs them. */
export function preloadBoardModels(folder = 'runtime-ktx2'): Promise<void> {
  let pending = preloads.get(folder);
  if (!pending) {
    const queue = [...BOARD_MODELS];
    const worker = async () => {
      let name: string | undefined;
      while ((name = queue.shift()) !== undefined) {
        try { await downloadModel(modelUrl(name, folder)); } catch { /* Optional warmup. */ }
      }
    };
    pending = Promise.all([worker(), worker()]).then(() => {});
    preloads.set(folder, pending);
  }
  return pending;
}
