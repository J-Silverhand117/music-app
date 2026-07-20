import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/500.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/doto/500.css';
import '@fontsource/doto/700.css';
import './styles.css';
import App from './App';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

// OS "open with" for the installed desktop PWA (File Handling API):
// files arrive here before React mounts, so park them until the app is ready.
if ('launchQueue' in window) {
  window.launchQueue.setConsumer(async params => {
    const files = [];
    for (const h of params.files || []) {
      try { files.push(await h.getFile()); } catch { /* skip unreadable */ }
    }
    if (!files.length) return;
    if (window.__launchImport) window.__launchImport(files);
    else window.__pendingLaunch = files;
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
