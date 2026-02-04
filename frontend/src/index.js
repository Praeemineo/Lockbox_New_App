import React from 'react';
import ReactDOM from 'react-dom/client';

// Note: SAPUI5 app is loaded directly from public/index.html
// This file is kept minimal to avoid conflicts

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><div /></React.StrictMode>);
}
