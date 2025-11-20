
import React, { useRef, useState, useEffect } from 'react';
import { StorageService } from '../services/storage';
import { User, UserRole } from '../types';
import { Download, Upload, Save, Users, Trash2, Plus, Key } from 'lucide-react';

const Settings: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // User Modal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [userForm, setUserForm] = useState({ username: '', password: '', role: UserRole.USER });
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    setUsers(StorageService.getUsers());
    setCurrentUser(StorageService.getSession());
  }, []);

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const handleExport = () => {
    const data = StorageService.exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VIMS_Backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (StorageService.importData(content)) {
        alert('数据导入成功！页面将刷新。');
        window.location.reload();
      } else {
        alert('导入失败，文件格式可能不正确。');
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteUser = (username: string) => {
    if (username === 'admin') return alert('无法删除默认管理员');
    if (username === currentUser?.username) return alert('无法删除自己');
    if (confirm(`确定要删除用户 ${username} 吗?`)) {
        const newUsers = users.filter(u => u.username !== username);
        setUsers(newUsers);
        StorageService.saveUsers(newUsers);
    }
  };

  const handleSaveUser = () => {
      if (!userForm.username || !userForm.password) return alert('请填写完整');
      
      let newUsers = [...users];
      if (isEditMode) {
          newUsers = newUsers.map(u => u.username === userForm.username ? { ...u, passwordHash: userForm.password, role: userForm.role } : u);
      } else {
          if (newUsers.find(u => u.username === userForm.username)) return alert('用户名已存在');
          newUsers.push({ username: userForm.username, passwordHash: userForm.password, role: userForm.role });
      }
      
      setUsers(newUsers);
      StorageService.saveUsers(newUsers);
      setIsUserModalOpen(false);
      setUserForm({ username: '', password: '', role: UserRole.USER });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">系统设置</h2>
      
      {/* Data Management */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Save className="text-blue-600" size={24} />
          </div>
          <h3 className="text-lg font-bold mb-2">数据备份</h3>
          <p className="text-slate-500 text-sm mb-4">
            导出所有系统数据（员工、车辆、证件、休假记录）为JSON文件。建议每周备份一次。
          </p>
          <button onClick={handleExport} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2">
            <Download size={18} /> 导出数据
          </button>
        </div>

        <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
          <div className="bg-orange-50 w-12 h-12 rounded-full flex items-center justify-center mb-4">
            <Upload className="text-orange-600" size={24} />
          </div>
          <h3 className="text-lg font-bold mb-2">数据恢复</h3>
          <p className="text-slate-500 text-sm mb-4">
            从JSON备份文件恢复数据。警告：这将覆盖当前的系统数据。
          </p>
          <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={handleImport}/>
          <button onClick={() => fileInputRef.current?.click()} className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded flex items-center gap-2">
            <Upload size={18} /> 选择备份文件
          </button>
        </div>
      </div>

      {/* User Management */}
      {isAdmin && (
          <div className="bg-white rounded-xl shadow border border-slate-100 overflow-hidden mb-8">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={20}/> 用户管理</h3>
                  <button onClick={() => { setIsEditMode(false); setUserForm({username:'', password:'', role: UserRole.USER}); setIsUserModalOpen(true); }} className="bg-green-600 text-white px-3 py-1.5 rounded flex items-center gap-1 text-sm hover:bg-green-700">
                      <Plus size={16}/> 添加用户
                  </button>
              </div>
              <table className="w-full text-left text-sm">
                  <thead>
                      <tr className="text-slate-500 bg-slate-50 border-b">
                          <th className="p-4">用户名</th>
                          <th className="p-4">角色</th>
                          <th className="p-4">密码</th>
                          <th className="p-4 text-right">操作</th>
                      </tr>
                  </thead>
                  <tbody>
                      {users.map(u => (
                          <tr key={u.username} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="p-4 font-medium">{u.username}</td>
                              <td className="p-4"><span className={`px-2 py-0.5 rounded text-xs ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span></td>
                              <td className="p-4 text-slate-400">******</td>
                              <td className="p-4 flex justify-end gap-2">
                                  <button onClick={() => { setIsEditMode(true); setUserForm({username: u.username, password: u.passwordHash, role: u.role}); setIsUserModalOpen(true); }} className="text-blue-600 hover:bg-blue-50 p-1 rounded" title="修改密码/权限"><Key size={16}/></button>
                                  {u.username !== 'admin' && u.username !== currentUser?.username && (
                                      <button onClick={() => handleDeleteUser(u.username)} className="text-red-500 hover:bg-red-50 p-1 rounded"><Trash2 size={16}/></button>
                                  )}
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-xl shadow-xl w-96">
                  <h3 className="font-bold text-lg mb-4">{isEditMode ? '编辑用户/重置密码' : '添加新用户'}</h3>
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm text-slate-600 mb-1">用户名</label>
                          <input type="text" disabled={isEditMode} className="w-full border rounded p-2 disabled:bg-slate-100" value={userForm.username} onChange={e => setUserForm({...userForm, username: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm text-slate-600 mb-1">密码</label>
                          <input type="text" className="w-full border rounded p-2" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} />
                      </div>
                      <div>
                          <label className="block text-sm text-slate-600 mb-1">角色</label>
                          <select className="w-full border rounded p-2" value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})}>
                              <option value={UserRole.USER}>普通用户</option>
                              <option value={UserRole.ADMIN}>管理员</option>
                          </select>
                      </div>
                      <div className="flex justify-end gap-2 mt-6">
                          <button onClick={() => setIsUserModalOpen(false)} className="px-4 py-2 border rounded hover:bg-slate-50">取消</button>
                          <button onClick={handleSaveUser} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      <div className="mt-8 p-6 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-center">
        <p className="text-slate-400 text-sm">VIMS Version 1.1.0</p>
        <p className="text-slate-400 text-xs mt-1">Enterprise Local Edition</p>
      </div>
    </div>
  );
};

export default Settings;
