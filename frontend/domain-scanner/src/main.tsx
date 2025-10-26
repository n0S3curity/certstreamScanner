import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

const rootElement = document.getElementById('root');

// The Docker build environment enforces a strict type check,
// so we must confirm the element exists before calling createRoot.
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
    // Log an error if the root element is missing
    console.error("Could not find root element with ID 'root'. Cannot mount React app.");
}
