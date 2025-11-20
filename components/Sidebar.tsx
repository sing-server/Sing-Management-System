
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Truck, 
  FileBadge, 
  CalendarDays, 
  Map, 
  Printer, 
  Settings, 
  LogOut,
  UserCircle
} from 'lucide-react';
import { StorageService } from '../services/storage';

interface SidebarProps {
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onLogout }) => {
  const location = useLocation();
  const session = StorageService.getSession();

  const navItems = [
    { path: '/', label: '综合看板', icon: <LayoutDashboard size={20} /> },
    { path: '/employees', label: '员工管理', icon: <Users size={20} /> },
    { path: '/vehicles', label: '车辆管理', icon: <Truck size={20} /> },
    { path: '/documents', label: '证件管理', icon: <FileBadge size={20} /> },
    { path: '/leave', label: '休假系统', icon: <CalendarDays size={20} /> },
    { path: '/routes', label: '排线系统', icon: <Map size={20} /> },
    { path: '/print', label: '打印中心', icon: <Printer size={20} /> },
    { path: '/settings', label: '系统设置', icon: <Settings size={20} /> },
  ];

  // Reduced width from 188px to 170px
  return (
    <div className="w-[170px] h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0 shadow-xl">
      <div className="p-6 border-b border-slate-800">
        <h1 className="text-xl font-bold text-blue-400 tracking-wider">sing</h1>
        <p className="text-xs text-slate-400 mt-1">综合可视化管理系统</p>
      </div>
      
      <nav className="flex-1 py-4 overflow-y-auto">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center px-6 py-3 text-sm transition-colors ${
              location.pathname === item.path 
                ? 'bg-blue-600 text-white border-r-4 border-white' 
                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <span className="mr-3">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-800/50">
        <div className="flex items-center mb-3 px-2">
            <UserCircle size={24} className="text-slate-400 mr-2"/>
            <div className="truncate">
                <p className="text-sm font-medium text-white truncate">{session?.username || 'Unknown'}</p>
                <p className="text-[10px] text-slate-400 uppercase">{session?.role || 'USER'}</p>
            </div>
        </div>
        <button 
          onClick={onLogout}
          className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-slate-800 rounded transition-colors"
        >
          <LogOut size={18} className="mr-2" />
          退出
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
