/// <reference types="vite/client" />
import '@fontsource/newsreader/400.css';
import '@fontsource/newsreader/400-italic.css';
import '@fontsource/newsreader/500.css';
import '@fontsource/instrument-sans/400.css';
import '@fontsource/instrument-sans/500.css';
import '@fontsource/instrument-sans/600.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
const render = () => root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Plain-browser `npm run dev`: fake the Tauri shell (dev/browserMock.ts).
if (import.meta.env.DEV && !('__TAURI_INTERNALS__' in window)) {
  import('./dev/browserMock').then(render);
} else {
  render();
}