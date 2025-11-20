
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excel';
import { Employee, POSITIONS, WEEK_DAYS, EXCEL_HEADERS, EmpStatus } from '../types';
import { Plus, Edit, Trash2, X, Search, Download, Upload, FileSpreadsheet, Clock, Check, Minus } from 'lucide-react';

const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false); 
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const initialFormState: Employee = {
    id: '',
    name: '',
    contact: '',
    idCard: '',
    joinDate: '',
    retireDate: '',
    resignationDate: '',
    transferDate: '',
    status: 'Active',
    hasPersonCert: false,
    hasPortCert: false,
    hasHKMacauPass: false,
    hasSecurityCert: false,
    positions: [],
    weeklyRestDays: []
  };
  const [formData, setFormData] = useState<Employee>(initialFormState);

  useEffect(() => {
    setEmployees(StorageService.getEmployees());
  }, []);

  const determineStatus = (emp: Employee): EmpStatus => {
      const today = new Date().toISOString().split('T')[0];
      if (emp.resignationDate && today > emp.resignationDate) return 'Resigned';
      if (emp.transferDate && today > emp.transferDate) return 'Transfer';
      if (emp.retireDate && today > emp.retireDate) return 'Retired';
      return 'Active';
  };

  const getServiceYears = (joinDate: string) => {
      if (!joinDate) return 0;
      const start = new Date(joinDate);
      const now = new Date();
      let years = now.getFullYear() - start.getFullYear();
      const m = now.getMonth() - start.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < start.getDate())) {
          years--;
      }
      return Math.max(0, years);
  };

  const handleSave = () => {
    if (!formData.name || !formData.id) return alert('工号和姓名必填');
    
    // Auto update status based on dates logic
    const updatedForm = { ...formData, status: determineStatus(formData) };
    
    let newEmployees = [...employees];
    if (editingId) {
      newEmployees = newEmployees.map(e => e.id === editingId ? updatedForm : e);
    } else {
      if (newEmployees.find(e => e.id === formData.id)) return alert('工号已存在');
      newEmployees.push(updatedForm);
    }
    
    setEmployees(newEmployees);
    StorageService.saveEmployees(newEmployees);
    setIsModalOpen(false);
    setFormData(initialFormState);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除该员工吗？')) {
      const updated = employees.filter(e => e.id !== id);
      setEmployees(updated);
      StorageService.saveEmployees(updated);
    }
  };

  const handleEdit = (emp: Employee) => {
    setFormData({ ...initialFormState, ...emp });
    setEditingId(emp.id);
    setIsModalOpen(true);
  };

  const togglePosition = (pos: string) => {
    const current = formData.positions;
    if (current.includes(pos)) {
      setFormData({ ...formData, positions: current.filter(p => p !== pos) });
    } else {
      setFormData({ ...formData, positions: [...current, pos] });
    }
  };

  const toggleRestDay = (day: number) => {
    // Only allow Sat(6) or Sun(0)
    if (day !== 0 && day !== 6) return;

    const current = formData.weeklyRestDays || [];
    if (current.includes(day)) {
      setFormData({ ...formData, weeklyRestDays: current.filter(d => d !== day) });
    } else {
      setFormData({ ...formData, weeklyRestDays: [...current, day] });
    }
  };

  const toggleBatchRestDay = (empId: string, day: number) => {
    // Only allow Sat(6) or Sun(0)
    if (day !== 0 && day !== 6) return;

    const newEmps = employees.map(e => {
        if (e.id !== empId) return e;
        const current = e.weeklyRestDays || [];
        const newDays = current.includes(day) ? current.filter(d => d !== day) : [...current, day];
        return { ...e, weeklyRestDays: newDays };
    });
    setEmployees(newEmps);
    StorageService.saveEmployees(newEmps);
  };

  const handleExport = () => {
    const data = employees.map(e => ({
        '工号': e.id,
        '姓名': e.name,
        '状态': getStatusLabel(e.status),
        '工龄': e.status === 'Active' ? getServiceYears(e.joinDate) : '-',
        '联系方式': e.contact,
        '身份证号': e.idCard,
        '入司时间': e.joinDate,
        '退休时间': e.retireDate,
        '岗位': e.positions.join(','),
        '每周休息日(0-6)': (e.weeklyRestDays || []).join(','),
        '人行人证(是/否)': e.hasPersonCert ? '是' : '否',
        '口岸人证(是/否)': e.hasPortCert ? '是' : '否',
        '港澳通行证(是/否)': e.hasHKMacauPass ? '是' : '否',
        '保安员证(是/否)': e.hasSecurityCert ? '是' : '否',
    }));
    ExcelService.exportToExcel(data, EXCEL_HEADERS.EMPLOYEE, '员工列表');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const rawData = await ExcelService.readExcel(file);
        const rows = rawData.slice(1);
        const imported: Employee[] = [];
        
        rows.forEach((row: any[]) => {
            if (row && row.length) {
                const emp = ExcelService.mapEmployeeImport(row);
                // Auto calculate status on import
                emp.status = determineStatus(emp);
                imported.push(emp);
            }
        });

        let currentData = [...employees];
        imported.forEach(newItem => {
            const existsIdx = currentData.findIndex(ex => ex.id === newItem.id);
            if (existsIdx >= 0) {
                currentData[existsIdx] = newItem;
            } else {
                currentData.push(newItem);
            }
        });
        
        setEmployees(currentData);
        StorageService.saveEmployees(currentData);
        alert(`成功导入 ${imported.length} 条数据`);
    } catch (err) {
        alert('文件解析失败');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const filtered = employees.filter(e => 
    e.name.includes(searchTerm) || e.id.includes(searchTerm)
  );

  const getStatusLabel = (s: EmpStatus) => {
      switch(s) {
          case 'Active': return '在职';
          case 'Resigned': return '离职';
          case 'Retired': return '退休';
          case 'Transfer': return '外调';
          default: return s;
      }
  };

  const getStatusBadge = (s: EmpStatus) => {
      switch(s) {
          case 'Active': return <span className="text-green-600 font-bold">在职</span>;
          case 'Resigned': return <span className="text-red-600">离职</span>;
          case 'Retired': return <span className="text-slate-500">退休</span>;
          case 'Transfer': return <span className="text-orange-600">外调</span>;
      }
  };

  const renderBoolean = (val: boolean) => val ? <Check size={16} className="text-green-600 inline"/> : <Minus size={16} className="text-slate-300 inline"/>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 no-print">
        <h2 className="text-2xl font-bold text-slate-800">员工管理系统</h2>
        <div className="flex gap-2 items-center">
            <button onClick={() => setIsHabitModalOpen(true)} className="btn-white flex items-center gap-2 text-blue-600 border-blue-200">
                <Clock size={18}/> 休假偏好设置
            </button>
            <button onClick={() => ExcelService.downloadTemplate('EMPLOYEE')} className="btn-white flex items-center gap-2" title="下载模板">
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
            <Plus size={18} /> 添加员工
            </button>
        </div>
      </div>

      <div className="mb-6 relative max-w-sm no-print">
        <Search className="absolute left-3 top-2.5 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="搜索姓名或工号..." 
          className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="vims-table-container bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead className="bg-slate-100 text-slate-700 text-sm font-bold">
            <tr>
              <th className="vims-table-header">工号</th>
              <th className="vims-table-header">姓名</th>
              <th className="vims-table-header">状态</th>
              <th className="vims-table-header">联系方式</th>
              <th className="vims-table-header">身份证号</th>
              <th className="vims-table-header">岗位</th>
              <th className="vims-table-header">工龄</th>
              <th className="vims-table-header">入司时间</th>
              <th className="vims-table-header">退休时间</th>
              <th className="vims-table-header">离职时间</th>
              <th className="vims-table-header">外调时间</th>
              <th className="vims-table-header">休假偏好</th>
              <th className="vims-table-header text-center">人行人证</th>
              <th className="vims-table-header text-center">口岸人证</th>
              <th className="vims-table-header text-center">港澳通行证</th>
              <th className="vims-table-header text-center">保安员证</th>
              <th className="vims-table-header no-print">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-base">
            {filtered.map(emp => (
              <tr key={emp.id} className="bg-white">
                <td className="vims-table-cell font-medium">{emp.id}</td>
                <td className="vims-table-cell font-bold">{emp.name}</td>
                <td className="vims-table-cell">{getStatusBadge(emp.status)}</td>
                <td className="vims-table-cell">{emp.contact}</td>
                <td className="vims-table-cell font-mono text-sm">{emp.idCard}</td>
                <td className="vims-table-cell">
                  <div className="flex gap-1">
                  {emp.positions.map(p => <span key={p} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs border border-blue-100">{p}</span>)}
                  </div>
                </td>
                <td className="vims-table-cell font-bold text-slate-700">
                    {emp.status === 'Active' ? `${getServiceYears(emp.joinDate)}年` : '-'}
                </td>
                <td className="vims-table-cell">{emp.joinDate}</td>
                <td className="vims-table-cell">{emp.retireDate || '-'}</td>
                <td className="vims-table-cell">{emp.resignationDate || '-'}</td>
                <td className="vims-table-cell">{emp.transferDate || '-'}</td>
                <td className="vims-table-cell">
                  {(emp.weeklyRestDays || []).map(d => WEEK_DAYS.find(w => w.val === d)?.label).join(', ')}
                </td>
                <td className="vims-table-cell text-center">{renderBoolean(emp.hasPersonCert)}</td>
                <td className="vims-table-cell text-center">{renderBoolean(emp.hasPortCert)}</td>
                <td className="vims-table-cell text-center">{renderBoolean(emp.hasHKMacauPass)}</td>
                <td className="vims-table-cell text-center">{renderBoolean(emp.hasSecurityCert)}</td>
                <td className="vims-table-cell no-print">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(emp)} className="text-slate-500 hover:text-blue-600"><Edit size={18} /></button>
                    <button onClick={() => handleDelete(emp.id)} className="text-slate-500 hover:text-red-600"><Trash2 size={18} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={17} className="p-8 text-center text-slate-400">暂无数据</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="text-xl font-bold text-slate-800">{editingId ? '编辑员工' : '添加员工'}</h3>
              <button onClick={() => setIsModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">工号 <span className="text-red-500">*</span></label>
                <input type="text" className="input-std" value={formData.id} onChange={e => setFormData({...formData, id: e.target.value})} disabled={!!editingId} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">姓名 <span className="text-red-500">*</span></label>
                <input type="text" className="input-std" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              
              {/* Dates affecting Status */}
              <div>
                <label className="block text-sm text-slate-600 mb-1">入司时间</label>
                <input type="date" className="input-std" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">退休时间</label>
                <input type="date" className="input-std" value={formData.retireDate} onChange={e => setFormData({...formData, retireDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">离职时间 (选填)</label>
                <input type="date" className="input-std" value={formData.resignationDate || ''} onChange={e => setFormData({...formData, resignationDate: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">外调时间 (选填)</label>
                <input type="date" className="input-std" value={formData.transferDate || ''} onChange={e => setFormData({...formData, transferDate: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1">联系方式</label>
                <input type="text" className="input-std" value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm text-slate-600 mb-1">身份证号</label>
                <input type="text" className="input-std" value={formData.idCard} onChange={e => setFormData({...formData, idCard: e.target.value})} />
              </div>

              <div className="col-span-2 bg-slate-50 p-2 rounded border">
                  <label className="block text-sm font-bold text-slate-700">当前状态 (自动计算): {getStatusBadge(determineStatus(formData))}</label>
                  {determineStatus(formData) === 'Active' && (
                      <label className="block text-sm font-bold text-blue-700 mt-1">
                          当前工龄: {getServiceYears(formData.joinDate)} 年
                      </label>
                  )}
                  <p className="text-xs text-slate-400 mt-1">状态将根据离职、外调、退休日期自动更新。</p>
              </div>

              <div className="col-span-2">
                 <label className="block text-sm text-slate-600 mb-2">岗位（多选）</label>
                 <div className="flex gap-3 flex-wrap">
                   {POSITIONS.map(pos => (
                     <button 
                      key={pos}
                      type="button"
                      onClick={() => togglePosition(pos)}
                      className={`px-3 py-1 rounded-full text-sm border ${formData.positions.includes(pos) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'}`}
                     >
                       {pos}
                     </button>
                   ))}
                 </div>
              </div>
              <div className="col-span-2">
                 <label className="block text-sm text-slate-600 mb-2">休假偏好 (仅限周六/周日)</label>
                 <div className="flex gap-2 flex-wrap">
                    {WEEK_DAYS.filter(d => d.val === 0 || d.val === 6).map(day => (
                        <button
                            key={day.val}
                            type="button"
                            onClick={() => toggleRestDay(day.val)}
                            className={`px-3 py-1 rounded-md text-sm border ${formData.weeklyRestDays?.includes(day.val) ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-600'}`}
                        >
                            {day.label}
                        </button>
                    ))}
                 </div>
              </div>
              <div className="col-span-2">
                <label className="block text-sm text-slate-600 mb-2">持有证件</label>
                <div className="flex gap-4 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.hasPersonCert} onChange={e => setFormData({...formData, hasPersonCert: e.target.checked})} /> 人行人证
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.hasPortCert} onChange={e => setFormData({...formData, hasPortCert: e.target.checked})} /> 口岸人证
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.hasHKMacauPass} onChange={e => setFormData({...formData, hasHKMacauPass: e.target.checked})} /> 港澳通行证
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.hasSecurityCert} onChange={e => setFormData({...formData, hasSecurityCert: e.target.checked})} /> 保安员证
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

      {/* Habits Batch Settings Modal - RESTRICTED to Sat/Sun */}
      {isHabitModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-6 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h3 className="text-xl font-bold text-slate-800">休假偏好设置 (批量)</h3>
                    <button onClick={() => setIsHabitModalOpen(false)}><X size={24} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                <p className="text-sm text-red-500 font-bold mb-4">注意：新的偏好设置将仅从 <span className="underline">下个月</span> 开始生效，当前月及历史月份的排班数据不受影响。</p>
                
                <div className="flex-1 overflow-y-auto border rounded-lg">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-3 border-b">工号</th>
                                <th className="p-3 border-b">姓名</th>
                                {WEEK_DAYS.filter(d => d.val === 6 || d.val === 0).map(d => (
                                    <th key={d.val} className="p-3 border-b text-center w-20">{d.label}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {employees.map(emp => (
                                <tr key={emp.id} className="bg-white">
                                    <td className="p-3 font-medium">{emp.id}</td>
                                    <td className="p-3">{emp.name}</td>
                                    {WEEK_DAYS.filter(d => d.val === 6 || d.val === 0).map(d => (
                                        <td key={d.val} className="p-3 text-center">
                                            <input 
                                                type="checkbox" 
                                                className="w-4 h-4 cursor-pointer accent-blue-600"
                                                checked={emp.weeklyRestDays?.includes(d.val)}
                                                onChange={() => toggleBatchRestDay(emp.id, d.val)}
                                            />
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="mt-4 flex justify-end">
                    <button onClick={() => setIsHabitModalOpen(false)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow">
                        完成
                    </button>
                </div>
            </div>
        </div>
      )}

      <style>{`
        .input-std {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #cbd5e1;
          border-radius: 0.5rem;
          outline: none;
        }
        .input-std:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }
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

export default Employees;
