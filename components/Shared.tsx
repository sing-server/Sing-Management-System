import React, { useState } from 'react';
import { X, Printer } from 'lucide-react';
import { StorageService } from '../services/storage';

// --- Password Modal ---
interface PasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title?: string;
}

export const PasswordModal: React.FC<PasswordModalProps> = ({ isOpen, onClose, onSuccess, title }) => {
    const [pwd, setPwd] = useState('');
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const session = StorageService.getSession();
        if (!session) {
            setError('会话已失效');
            return;
        }
        if (session.passwordHash === pwd) {
            setPwd('');
            setError('');
            onSuccess();
        } else {
            setError('密码错误');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] no-print">
            <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-lg text-slate-800">{title || '安全验证'}</h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                <form onSubmit={handleSubmit}>
                    <p className="text-sm text-slate-500 mb-3">请输入当前登录用户的密码以解锁：</p>
                    <input 
                        type="password" 
                        autoFocus
                        className="w-full border border-slate-300 rounded-lg p-2 mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="密码"
                        value={pwd}
                        onChange={e => setPwd(e.target.value)}
                    />
                    {error && <p className="text-red-500 text-xs mb-2">{error}</p>}
                    
                    <div className="flex justify-end gap-2 mt-4">
                        <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm border rounded hover:bg-slate-50">取消</button>
                        <button type="submit" className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">确认解锁</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- Print Preview Modal ---
interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    content: React.ReactNode;
    title: string;
}

export const PrintModal: React.FC<PrintModalProps> = ({ isOpen, onClose, content, title }) => {
    if (!isOpen) return null;

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[200] flex flex-col items-center justify-center print-preview-container">
            {/* Header - Hidden when printing */}
            <div className="bg-white w-full max-w-6xl p-4 rounded-t-xl border-b flex justify-between items-center no-print shadow-lg">
                <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
                    <Printer className="text-blue-600"/> 打印预览: {title}
                </h3>
                <div className="flex gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded border hover:bg-slate-50 text-slate-600">关闭</button>
                    <button onClick={handlePrint} className="px-6 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 shadow font-bold flex items-center gap-2">
                        <Printer size={18}/> 打印
                    </button>
                </div>
            </div>
            
            {/* Content - Visible when printing */}
            <div className="bg-white w-full max-w-6xl p-8 rounded-b-xl shadow-2xl overflow-y-auto max-h-[85vh] print-preview-mode">
                <div className="min-w-full">
                    {content}
                </div>
            </div>
        </div>
    );
};