
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { StorageService } from './services/storage';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import Vehicles from './pages/Vehicles';
import Documents from './pages/Documents';
import Leave from './pages/Leave';
import Settings from './pages/Settings';

// Placeholders for unimplemented pages
const Placeholder = ({ title }: { title: string }) => (
  <div className="p-10 text-center text-slate-400">
    <h2 className="text-2xl font-bold mb-2">{title}</h2>
    <p>Feature interface reserved.</p>
  </div>
);

const App: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const session = StorageService.getSession();
    if (session) {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    StorageService.setSession(null);
    setIsAuthenticated(false);
  };

  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar onLogout={handleLogout} />
        {/* Adjusted margin to match new sidebar width (170px) */}
        <main className="flex-1 ml-[170px] p-4 overflow-y-auto h-screen">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/vehicles" element={<Vehicles />} />
            <Route path="/documents" element={<Documents />} />
            <Route path="/leave" element={<Leave />} />
            <Route path="/routes" element={<Placeholder title="排线系统 (预留接口)" />} />
            <Route path="/print" element={<Placeholder title="打印中心 (预留接口)" />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
