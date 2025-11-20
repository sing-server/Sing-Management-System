import React, { useEffect, useState } from 'react';
import { StorageService } from '../services/storage';
import { Users, Truck, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({
    empCount: 0,
    vehicleCount: 0,
    expiringDocs: 0
  });

  useEffect(() => {
    const emps = StorageService.getEmployees();
    const vehicles = StorageService.getVehicles();
    const docs = StorageService.getDocuments();
    
    // Calc expiring
    const today = new Date();
    const expiring = docs.filter(d => {
      const exp = new Date(d.expiryDate);
      const diff = (exp.getTime() - today.getTime()) / (1000 * 3600 * 24);
      return diff <= 30;
    });

    setStats({
      empCount: emps.length,
      vehicleCount: vehicles.length,
      expiringDocs: expiring.length
    });
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-3xl font-bold text-slate-800 mb-8">综合管理看板</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Link to="/employees" className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-blue-100 text-sm font-medium">在职员工</p>
              <h3 className="text-4xl font-bold mt-2">{stats.empCount}</h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <Users size={32} />
            </div>
          </div>
        </Link>

        <Link to="/vehicles" className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-emerald-100 text-sm font-medium">管理车辆</p>
              <h3 className="text-4xl font-bold mt-2">{stats.vehicleCount}</h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <Truck size={32} />
            </div>
          </div>
        </Link>

        <Link to="/documents" className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-orange-100 text-sm font-medium">即将过期证件</p>
              <h3 className="text-4xl font-bold mt-2">{stats.expiringDocs}</h3>
            </div>
            <div className="bg-white bg-opacity-20 p-3 rounded-lg">
              <AlertTriangle size={32} />
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100 min-h-[300px] flex flex-col items-center justify-center text-slate-400">
          <p>休假统计图表区域 (Placeholder)</p>
          <p className="text-xs mt-2">Charts rendered here</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100 min-h-[300px] flex flex-col items-center justify-center text-slate-400">
          <p>排线状态地图区域 (Placeholder)</p>
          <p className="text-xs mt-2">Map integration here</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;