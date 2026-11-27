import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserServices, ServicesProvider } from './application/services';
import { App } from './ui/App';
import './ui/styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicesProvider services={createBrowserServices()}>
      <App />
    </ServicesProvider>
  </StrictMode>,
);
