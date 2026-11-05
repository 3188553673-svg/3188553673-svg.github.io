async function readConfiguration() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(new URL('./connection.json', import.meta.url), {
      cache: 'no-store', credentials: 'omit', signal: controller.signal,
    });
    if (!response.ok) throw new Error('configuration');
    const config = await response.json();
    if (config.mode === 'direct' && !config.serverUrl) return { mode: 'direct' };
    if (config.mode !== 'relay') throw new Error('mode');
    const url = new URL(config.serverUrl);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('address');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new Error('https');
    return { mode: 'relay', serverUrl: url.origin };
  } catch {
    return { mode: 'unavailable' };
  }
  finally { clearTimeout(timeout); }
}

const config = await readConfiguration();
export const isCloudMode = config.mode === 'relay';
export const connectionError = config.mode === 'unavailable' ? '无法读取联机设置，请刷新页面后重试' : '';
export const networkLabel = isCloudMode ? '云端 · 双人对决' : '直连 · 双人对决';
export const connectionTimeout = isCloudMode ? 115000 : 30000;
const Transport = isCloudMode
  ? (await import('./cloud-transport.js')).CloudTransport
  : config.mode === 'direct' ? (await import('./p2p-transport.js')).P2PTransport : null;
export function createTransport() { return new Transport(config.serverUrl); }
