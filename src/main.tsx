import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './styles/app.css';
import { Layout } from './components/Layout';
import { PropertyPage } from './pages/PropertyPage';

const ComparePage = lazy(() => import('./pages/ComparePage'));
const ScenariosPage = lazy(() => import('./pages/ScenariosPage'));
const DataLibraryPage = lazy(() => import('./pages/DataLibraryPage'));
const MethodologyPage = lazy(() => import('./pages/MethodologyPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ReportPage = lazy(() => import('./pages/ReportPage'));

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Suspense fallback={<p className="muted">Loading page…</p>}>
          <Routes>
            <Route path="/" element={<Navigate to="/city-hotel" replace />} />
            <Route path="/city-hotel" element={<PropertyPage pid="city-hotel" />} />
            <Route path="/island-resort" element={<PropertyPage pid="island-resort" />} />
            <Route path="/independent-bnb" element={<PropertyPage pid="independent-bnb" />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/scenarios" element={<ScenariosPage />} />
            <Route path="/data-library" element={<DataLibraryPage />} />
            <Route path="/methodology" element={<MethodologyPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/report/:pid" element={<ReportPage />} />
            <Route path="*" element={<p>Page not found. <a href="/city-hotel">Go to the city hotel</a>.</p>} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
