
import React, { useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { User, UserRole } from '../types';
import { ShieldCheck } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    // Seed initial admin if empty
    const users = StorageService.getUsers();
    if (users.length === 0) {
      // Prompt Requirement: Default admin / password
      StorageService.saveUsers([{ username: 'admin', passwordHash: 'password', role: UserRole.ADMIN }]);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const users = StorageService.getUsers();
    const user = users.find(u => u.username === username && u.passwordHash === password);
    
    if (user) {
      StorageService.setSession(user);
      onLogin();
    } else {
      setError('用户名或密码错误');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-blue-600 p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white bg-opacity-20 rounded-full mb-4">
            <ShieldCheck size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white">sing 综合管理系统</h2>
          <p className="text-blue-100 text-sm mt-1">sing Comprehensive Management System</p>
        </div>
        
        <div className="p-8">
          <h3 className="text-xl font-semibold text-slate-800 mb-6 text-center">
            账号登录
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">用户名</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">密码</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <button
              type="submit"
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors shadow-md"
            >
              登 录
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-slate-500">
             如需注册或重置密码，请联系系统管理员。
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;