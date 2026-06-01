import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { StoreProvider } from './state/store.jsx';
import { ImporterProvider } from './components/useImporter.jsx';
import { ToastProvider } from './components/Toast.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <ToastProvider>
        <ImporterProvider>
          <App />
        </ImporterProvider>
      </ToastProvider>
    </StoreProvider>
  </React.StrictMode>
);
