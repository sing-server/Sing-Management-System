
import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excel';
import { DocumentItem, DOC_TYPES, EXCEL_HEADERS } from '../types';
import { Plus, Edit, Trash2, X, AlertTriangle, CheckCircle, Download, Upload, FileSpreadsheet, XCircle } from 'lucide-react';

const Documents: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initialForm: DocumentItem = {
    id: '',
    name: '', 
    type: 'PersonCert',
    expiryDate: '',
    holderName: '',
    status: 'Valid'
  };
  const [formData, setFormData] = useState<DocumentItem>(initialForm);

  useEffect(() => {
    setDocuments(StorageService.getDocuments());
  }, []);

  const handleSave = () => {
    if (!formData.expiryDate || !formData.holderName) return alert('有效期和持有人必填');
    let newDocs = [...documents];
    if (editingId) {
      newDocs = newDocs.map(d => d.id === editingId ? formData : d);
    } else {
      newDocs.push({ ...formData, id: Date.now().toString() });
    }
    setDocuments(newDocs);
    StorageService.saveDocuments(newDocs);
    setIsModalOpen(false);
  };

  const getDaysUntilExpiry = (dateStr: string) => {
    const today = new Date();
    const expiry = new Date(dateStr);
    const diffTime = expiry.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  };

  const getTypeLabel = (typeVal: string) => DOC_TYPES.find(d => d.value === typeVal)?.label || typeVal;

  // Excel
  const handleExport = () => {
      const data = documents.map(d => ({
          '证件类型': getTypeLabel(d.type),
          '持有人/车': d.holderName,
          '证件名称/编号': d.name,
          '状态(有效/无效)': d.status === 'Valid' ? '有效' : '无效',
          '有效期(YYYY-MM-DD)': d.expiryDate
      }));
      ExcelService.exportToExcel(data, EXCEL_HEADERS.DOCUMENT, '证件列表');
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
        const rawData = await ExcelService.readExcel(file);
        const rows = rawData.slice(1);
        const imported: DocumentItem[] = [];
        rows.forEach(row => {
            if (row && row.length) imported.push(ExcelService.mapDocumentImport(row));
        });
        const newData = [...documents, ...imported];
        setDocuments(newData);
        StorageService.saveDocuments(newData);
        alert(`导入 ${imported.length} 条数据`);
    } catch (err) {
        alert('导入失败');
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Sort by expiry: Urgent first, but invalid last
  const sortedDocs = [...documents].sort((a, b) => {
    if (a.status === 'Invalid' && b.status === 'Valid') return 1;
    if (a.status === 'Valid' && b.status === 'Invalid') return -1;
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 no-print">
        <h2 className="text-2xl font-bold text-slate-800">证件管理系统</h2>
        <div className="flex gap-2 items-center">
            <button onClick={() => ExcelService.downloadTemplate('DOCUMENT')} className="btn-white flex items-center gap-2" title="下载模板">
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
            onClick={() => { setEditingId(null); setFormData(initialForm); setIsModalOpen(true); }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 ml-2"
            >
            <Plus size={18} /> 添加证件
            </button>
        </div>
      </div>

      <div className="vims-table-container bg-white rounded-xl shadow border border-slate-100 overflow-hidden">
        <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-slate-100 text-slate-700 text-sm font-bold">
                <tr>
                    <th className="vims-table-header">证件类型</th>
                    <th className="vims-table-header">持有人/车</th>
                    <th className="vims-table-header">证件名称/编号</th>
                    <th className="vims-table-header">状态</th>
                    <th className="vims-table-header">有效期截止</th>
                    <th className="vims-table-header">剩余天数</th>
                    <th className="vims-table-header no-print">操作</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-base">
                {sortedDocs.map(doc => {
                    const daysLeft = getDaysUntilExpiry(doc.expiryDate);
                    const isExpired = daysLeft < 0;
                    const isWarning = daysLeft >= 0 && daysLeft <= 30;
                    
                    return (
                        <tr key={doc.id} className="bg-white">
                            <td className="vims-table-cell font-bold text-slate-800">{getTypeLabel(doc.type)}</td>
                            <td className="vims-table-cell">{doc.holderName}</td>
                            <td className="vims-table-cell font-mono text-sm text-slate-500">{doc.name || '-'}</td>
                            <td className="vims-table-cell">
                                <span className={`px-2 py-0.5 rounded text-xs ${doc.status === 'Valid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {doc.status === 'Valid' ? '有效' : '无效'}
                                </span>
                            </td>
                            <td className="vims-table-cell">{doc.expiryDate}</td>
                            <td className="vims-table-cell">
                                <div className="flex items-center gap-2">
                                    {doc.status === 'Invalid' ? (
                                        <span className="text-slate-400 flex items-center gap-1"><XCircle size={14}/> 已失效</span>
                                    ) : isExpired ? (
                                        <span className="text-red-600 font-bold flex items-center gap-1"><AlertTriangle size={14}/> 已过期 {Math.abs(daysLeft)} 天</span>
                                    ) : isWarning ? (
                                        <span className="text-orange-600 font-bold flex items-center gap-1"><AlertTriangle size={14}/> 剩余 {daysLeft} 天</span>
                                    ) : (
                                        <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14}/> {daysLeft} 天</span>
                                    )}
                                </div>
                            </td>
                            <td className="vims-table-cell no-print">
                                <div className="flex gap-2">
                                    <button onClick={() => { setFormData(doc); setEditingId(doc.id); setIsModalOpen(true); }} className="text-slate-500 hover:text-blue-600"><Edit size={18}/></button>
                                    <button onClick={() => {
                                        if(window.confirm('删除证件？')) {
                                            const n = documents.filter(d => d.id !== doc.id);
                                            setDocuments(n);
                                            StorageService.saveDocuments(n);
                                        }
                                    }} className="text-slate-500 hover:text-red-600"><Trash2 size={18}/></button>
                                </div>
                            </td>
                        </tr>
                    );
                })}
                {documents.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">暂无证件数据</td></tr>
                )}
            </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
           <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">{editingId ? '编辑证件' : '添加证件'}</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600">证件类型</label>
                  <select 
                    className="w-full p-2 border rounded"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as any})}
                  >
                    {DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                   <label className="block text-sm text-slate-600">持有人/车 (名称)</label>
                   <input type="text" className="w-full p-2 border rounded" value={formData.holderName} onChange={e => setFormData({...formData, holderName: e.target.value})} />
                </div>
                <div>
                   <label className="block text-sm text-slate-600">证件名称/编号</label>
                   <input type="text" className="w-full p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="可选" />
                </div>
                <div>
                   <label className="block text-sm text-slate-600">有效期截止</label>
                   <input type="date" className="w-full p-2 border rounded" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} />
                </div>
                <div>
                   <label className="block text-sm text-slate-600">状态</label>
                   <select className="w-full p-2 border rounded" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                       <option value="Valid">有效</option>
                       <option value="Invalid">无效</option>
                   </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 border rounded">取消</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
              </div>
           </div>
        </div>
      )}
      <style>{`
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

export default Documents;
