import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { seedSettings } from './lib/seed';
import { AuthProvider } from './context/AuthContext';
import { SettingsProvider } from './context/SettingsContext';
import { RoleProvider } from './context/RoleContext';
import { DataProvider } from './context/DataContext';
import { BrowserRouter } from 'react-router-dom';

seedSettings();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <RoleProvider>
          <DataProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </DataProvider>
        </RoleProvider>
      </SettingsProvider>
    </AuthProvider>
  </StrictMode>,
);
