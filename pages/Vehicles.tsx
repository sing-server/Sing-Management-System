
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excel';
import { Vehicle, VEHICLE_TYPES, EXCEL_HEADERS } from '../types';
import { Plus, Edit, Trash2, X, Search, Download, Upload, FileSpreadsheet, Check, Minus } from 'lucide-react';

const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialFormState: Vehicle = {
    id: '',
    internalId: '',
    plateNumber: '',
    types: [],
    capacity: 0,
    status: 'Valid',
    hasPersonVehicleCert: false,
    hasPortVehicleCert: false,
  };
  const [formData, setFormData] = useState<Vehicle>(initialFormState);

  useEffect(() => {
    setVehicles(StorageService.getVehicles());
  }, []);

  const handleSave = () => {
    if (!formData.internalId || !formData.plateNumber) return alert('自编号和车牌号必填');
    
    let newVehicles = [...vehicles];
    if (editingId) {
      newVehicles = newVehicles.map(v => v.id === editingId ? formData : v);
    } else {
      const newVehicle = { ...formData, id: Date.now().toString() };
      newVehicles.push(newVehicle);
    }
    
    setVehicles(newVehicles);
    StorageService.saveVehicles(newVehicles);
    setIsModalOpen(false);
    setFormData(initialFormState);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除该车辆吗？')) {
      const updated = vehicles.filter(v => v.id !== id);
      setVehicles(updated);
      StorageService.saveVehicles(updated);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setFormData(vehicle);
    setEditingId(vehicle.id);
    setIsModalOpen(true);
  };

  const toggleType = (type: string) => {
    const current = formData.types;
    if (current.includes(type)) {
      setFormData({ ...formData, types: current.filter(t => t !== type) });
    } else {
      setFormData({ ...formData, types: [...current, type] });
    }
  };

  const handleExport = () => {
      const data = vehicles.map(v => ({
          '自编号': v.internalId,
          '车牌号': v.plateNumber,
          '车型': v.types.join(','),
          '载重(吨)': v.capacity,
          '状态(有效/无效)': v.status === 'Valid' ? '有效' : '无效',
          '人行车证(是/否)': v.hasPersonVehicleCert ? '是' : '否',
          '口岸车证(是/否)': v.hasPortVehicleCert ? '是' : '否',
      }));
      ExcelService.exportToExcel(data, EXCEL_HEADERS.VEHICLE, '车辆列表');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
          const rawData = await ExcelService.readExcel(file);
          const rows = rawData.slice(1);
          const imported: Vehicle[] = [];
          
          rows.forEach(row => {
              if (row && row.length) {
                  imported.push(ExcelService.mapVehicleImport(row));
              }
          });
          
          const newData = [...vehicles, ...imported];
          setVehicles(newData);
          StorageService.saveVehicles(newData);
          alert(`成功导入 ${imported.length} 辆车`);
      } catch (err) {
          alert('导入失败');
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filtered = vehicles.filter(v => 
    v.plateNumber.includes(searchTerm) || v.internalId.includes(searchTerm)
  );

  const renderBoolean = (val: boolean) => val ? <Check size={16} className="text-green-600 inline"/> : <Minus size={16} className="text-slate-300 inline"/>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 no-print">
        <h2 className="text-2xl font-bold text-slate-800">车辆管理系统</h2>
        <div className="flex gap-2 items-center">
            <button onClick={() => ExcelService.downloadTemplate('VEHICLE')} className="btn-white flex items-center gap-2" title="下载模板">
                <FileSpreadsheet size={18}/> 模板
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-white flex items-center gap-2">
                <Upload size={18}/> 导入
            </button>
            <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx, .xls" />
            <button onClick={handleExport} className="btn-white flex items-center gap-2">
                <Download size={18}/> 导出
            </button>
            <button 
            onClick={() => { setEditingId(null); setFormData(initialFormState); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 ml-2"
            >
            <Plus size={18} /> 添加车辆
            </button>
        </div>
      </div>

      <div className="mb-6 relative max-w-sm no-print">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="搜索自编号或车牌..." 
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="vims-table-container bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-700 text-sm font-bold">
                <tr>
                    <th className="vims-table-header">自编号</th>
                    <th className="vims-table-header">车牌号</th>
                    <th className="vims-table-header">状态</th>
                    <th className="vims-table-header">车型</th>
                    <th className="vims-table-header">载重 (吨)</th>
                    <th className="vims-table-header text-center">人行车证</th>
                    <th className="vims-table-header text-center">口岸车证</th>
                    <th className="vims-table-header no-print">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-base">
                {filtered.map(v => (
                    <tr key={v.id} className="bg-white">
                        <td className="vims-table-cell font-medium text-slate-500">{v.internalId}</td>
                        <td className="vims-table-cell font-bold text-slate-800">{v.plateNumber}</td>
                        <td className="vims-table-cell">
                            <span className={`px-2 py-0.5 rounded text-xs ${v.status === 'Valid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {v.status === 'Valid' ? '有效' : '无效'}
                            </span>
                        </td>
                        <td className="vims-table-cell">{v.types.join(', ')}</td>
                        <td className="vims-table-cell">{v.capacity}</td>
                        <td className="vims-table-cell text-center">{renderBoolean(v.hasPersonVehicleCert)}</td>
                        <td className="vims-table-cell text-center">{renderBoolean(v.hasPortVehicleCert)}</td>
                        <td className="vims-table-cell no-print">
                            <div className="flex gap-2">
                                <button onClick={() => handleEdit(v)} className="text-slate-500 hover:text-blue-600"><Edit size={18} /></button>
                                <button onClick={() => handleDelete(v.id)} className="text-slate-500 hover:text-red-600"><Trash2 size={18} /></button>
                            </div>
                        </td>
                    </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">暂无车辆数据</td></tr>
                )}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? '编辑车辆' : '添加车辆'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400"/></button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-std">自编号</label>
                  <input type="text" className="input-std" value={formData.internalId} onChange={e => setFormData({...formData, internalId: e.target.value})} />
                </div>
                <div>
                  <label className="label-std">车牌号</label>
                  <input type="text" className="input-std" value={formData.plateNumber} onChange={e => setFormData({...formData, plateNumber: e.target.value})} />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="label-std">载重 (吨)</label>
                    <input type="number" className="input-std" value={formData.capacity} onChange={e => setFormData({...formData, capacity: parseFloat(e.target.value)})} />
                </div>
                <div>
                    <label className="label-std">状态</label>
                    <select className="input-std" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                        <option value="Valid">有效</option>
                        <option value="Invalid">无效</option>
                    </select>
                </div>
              </div>

              <div>
                <label className="label-std mb-2 block">车型 (多选)</label>
                <div className="flex flex-wrap gap-2">
                  {VEHICLE_TYPES.map(t => (
                    <button 
                      key={t}
                      onClick={() => toggleType(t)}
                      className={`px-3 py-1 text-sm rounded-full border ${formData.types.includes(t) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600'}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="label-std mb-2 block">证件资质</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.hasPersonVehicleCert} onChange={e => setFormData({...formData, hasPersonVehicleCert: e.target.checked})} /> 人行车证
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={formData.hasPortVehicleCert} onChange={e => setFormData({...formData, hasPortVehicleCert: e.target.checked})} /> 口岸车证
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded-lg hover:bg-slate-50">取消</button>
              <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .label-std { font-size: 0.875rem; color: #475569; margin-bottom: 0.25rem; display: block; }
        .input-std { width: 100%; padding: 0.5rem; border: 1px solid #cbd5e1; border-radius: 0.5rem; outline: none; }
        .input-std:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.2); }
        .btn-white {
            padding: 0.5rem 1rem;
            border: 1px solid #e2e8f0;
            background: white;
            color: #475569;
            border-radius: 0.5rem;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        .btn-white:hover {
            background: #f8fafc;
            border-color: #cbd5e1;
        }
      `}</style>
    </div>
  );
};

export default Vehicles;
