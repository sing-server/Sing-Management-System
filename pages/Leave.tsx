import React, { useState, useEffect, useRef } from 'react';
import { StorageService } from '../services/storage';
import { ExcelService } from '../services/excel';
import { Employee, MonthlyLeave, AnnualLeaveYear, AnnualLeaveSlot, WEEK_DAYS, StatutoryHoliday } from '../types';
import { Calendar, Save, Plus, Trash2, Trophy, Settings, RefreshCw, X, ArrowRight, ArrowLeft, Download, Upload, FileSpreadsheet, Lock, Unlock, Search, Clock, Briefcase, BarChart3, Filter, Printer, Coffee, ListRestart, Trash } from 'lucide-react';
import { PasswordModal, PrintModal } from '../components/Shared';

type DayType = 'WORK' | 'WEEKEND' | 'STATUTORY' | 'NORMAL_HOLIDAY';

const STATUTORY_NAMES = ['元旦节', '春节', '清明节', '劳动节', '端午节', '中秋节', '国庆节'];
// Defined Major Holidays for exclusive statistical counting
const MAJOR_HOLIDAYS = ['春节', '劳动节', '国庆节'];

const Leave: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'monthly' | 'annual'>('monthly');
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // --- Lock / Unlock State ---
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingUnlockAction, setPendingUnlockAction] = useState<(() => void) | null>(null);

  // --- Print State ---
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printContent, setPrintContent] = useState<React.ReactNode>(null);
  const [printTitle, setPrintTitle] = useState('');

  // --- Monthly State ---
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthlyRecords, setMonthlyRecords] = useState<MonthlyLeave[]>([]);
  const [unlockedMonths, setUnlockedMonths] = useState<Set<string>>(new Set()); 
  const [manuallyLockedMonths, setManuallyLockedMonths] = useState<Set<string>>(new Set()); 

  // --- Annual State ---
  const [annualSubTab, setAnnualSubTab] = useState<'settings' | 'cumulative' | 'history' | 'predeclare' | 'result'>('predeclare');
  const [annualYearVal, setAnnualYearVal] = useState(new Date().getFullYear() + 1);
  const [annualData, setAnnualData] = useState<AnnualLeaveYear | null>(null);
  const [isPredeclareUnlocked, setIsPredeclareUnlocked] = useState(false);
  
  // --- Annual UI State ---
  const [predeclareMonthFilter, setPredeclareMonthFilter] = useState<string>('0'); 
  const [resultMonthFilter, setResultMonthFilter] = useState<string>('0');

  // --- Settings Inputs ---
  // Default Name BLANK for Statutory
  const [newStatHoliday, setNewStatHoliday] = useState<{name: string, customName: string, startDate: string, endDate: string}>({
      name: '', customName: '', startDate: '', endDate: ''
  });
  // Default Dates TODAY for Normal Holiday
  const todayStr = new Date().toISOString().split('T')[0];
  const [newNormalHoliday, setNewNormalHoliday] = useState<{startDate: string, endDate: string}>({
      startDate: todayStr, endDate: todayStr
  });
  // Default Date TODAY for Custom Workday
  const [newCustomWorkday, setNewCustomWorkday] = useState(todayStr);

  // --- Cumulative Stats Filter State ---
  const [statStartYear, setStatStartYear] = useState<number>(1997);
  const [statEndYear, setStatEndYear] = useState<number>(2099);

  // --- Input State for Predeclare ---
  const [candidateInputs, setCandidateInputs] = useState<Record<string, string>>({});
  const [foundCandidates, setFoundCandidates] = useState<Record<string, string>>({}); 

  // --- Habit Settings State ---
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [habitSearchId, setHabitSearchId] = useState('');

  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const fmtZero = (val: any) => (val === 0 || val === '0' || val === '0.0' || val === 0.0) ? '' : val;

  // --- HELPER: Service Years & Annual Quota ---
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

  const calculateAnnualQuota = (joinDate: string): number => {
      const years = getServiceYears(joinDate);
      if (years < 1) return 0;
      if (years < 10) return 5;
      if (years < 20) return 10;
      return 15;
  };

  const shouldShowEmployee = (emp: Employee, year: number, month: number): boolean => {
      const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      if (emp.status === 'Active') return true;
      if (emp.status === 'Resigned') return !!(emp.resignationDate && emp.resignationDate >= monthStart);
      if (emp.status === 'Transfer') return !!(emp.transferDate && emp.transferDate >= monthStart);
      if (emp.status === 'Retired') return !!(emp.retireDate && emp.retireDate >= monthStart);
      return false; 
  };

  const getFilteredEmployees = (year: number, month: number) => {
      return employees.filter(e => shouldShowEmployee(e, year, month));
  };

  // --- Initialization ---
  useEffect(() => {
    const emps = StorageService.getEmployees();
    setEmployees(emps);
    
    const year = monthDate.getFullYear();
    let annData = StorageService.getAnnualLeave().find(y => y.year === year);
    if (!annData) {
         annData = { 
            year: year, 
            holidays: [], 
            normalHolidays: [],
            customWorkdays: [],
            slots: [], 
            historyStats: {} 
        };
    }
    setAnnualData(annData);
    loadMonthlyData(emps, annData);
  }, [monthDate]);

  useEffect(() => {
    if (activeTab === 'annual') {
        loadAnnualData(annualYearVal);
        setIsPredeclareUnlocked(false); 
    }
  }, [annualYearVal, activeTab]);

  // --- LOCK LOGIC ---
  const triggerUnlock = (action: () => void) => {
      setPendingUnlockAction(() => action);
      setPasswordModalOpen(true);
  };

  const handlePasswordSuccess = () => {
      setPasswordModalOpen(false);
      if (pendingUnlockAction) {
          pendingUnlockAction();
          setPendingUnlockAction(null);
      }
  };

  // Monthly Lock
  const getMonthKey = () => `${monthDate.getFullYear()}-${monthDate.getMonth() + 1}`;
  const isMonthLocked = () => {
      const now = new Date();
      const viewYear = monthDate.getFullYear();
      const viewMonth = monthDate.getMonth() + 1;
      const isPast = viewYear < now.getFullYear() || (viewYear === now.getFullYear() && viewMonth < (now.getMonth() + 1));
      const key = getMonthKey();
      if (isPast) return !unlockedMonths.has(key);
      return manuallyLockedMonths.has(key);
  };

  const handleMonthLockClick = () => {
      const locked = isMonthLocked();
      const key = getMonthKey();
      if (locked) {
          triggerUnlock(() => {
              if (manuallyLockedMonths.has(key)) {
                  const newSet = new Set(manuallyLockedMonths);
                  newSet.delete(key);
                  setManuallyLockedMonths(newSet);
              } else {
                  const newSet = new Set(unlockedMonths);
                  newSet.add(key);
                  setUnlockedMonths(newSet);
              }
          });
      } else {
          if (unlockedMonths.has(key)) {
              const newSet = new Set(unlockedMonths);
              newSet.delete(key);
              setUnlockedMonths(newSet);
          } else {
              const newSet = new Set(manuallyLockedMonths);
              newSet.add(key);
              setManuallyLockedMonths(newSet);
          }
      }
  };

  // Annual Lock
  const handleAnnualLockClick = () => {
      if (isPredeclareUnlocked) {
          setIsPredeclareUnlocked(false);
      } else {
          triggerUnlock(() => setIsPredeclareUnlocked(true));
      }
  };

  // --- DATA LOADING & HELPERS ---
  const getDayTypeStatic = (dateStr: string, annData: AnnualLeaveYear): DayType => {
    if (!annData) return 'WORK';
    const isStatutory = annData.holidays.some(h => dateStr >= h.startDate && dateStr <= h.endDate);
    if (isStatutory) return 'STATUTORY';
    const isNormalHoliday = (annData.normalHolidays || []).some(h => dateStr >= h.startDate && dateStr <= h.endDate);
    if (isNormalHoliday) return 'NORMAL_HOLIDAY';
    if (annData.customWorkdays.includes(dateStr)) return 'WORK';
    const date = new Date(dateStr);
    const day = date.getDay();
    if (day === 0 || day === 6) return 'WEEKEND';
    return 'WORK';
  };

  const getApprovedAnnualLeaveDays = (empId: string, viewYear: number, viewMonth: number): number[] => {
      const allYearsData = StorageService.getAnnualLeave();
      const approvedDays: number[] = [];
      allYearsData.forEach(annData => {
          if (!annData.slots) return;
          annData.slots.forEach(slot => {
              if (slot.approved.includes(empId)) {
                  const sDate = new Date(slot.startDate);
                  const eDate = new Date(slot.endDate);
                  for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
                      if (d.getFullYear() === viewYear && d.getMonth() + 1 === viewMonth) {
                          approvedDays.push(d.getDate());
                      }
                  }
              }
          });
      });
      return approvedDays;
  };

  const loadMonthlyData = (currentEmps: Employee[], annData: AnnualLeaveYear) => {
    const allRecords = StorageService.getMonthlyLeave();
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    let hasChanges = false;
    const recordsForView = [...allRecords];
    
    const now = new Date();
    const isStrictFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);

    currentEmps.forEach(emp => {
        if (!shouldShowEmployee(emp, year, month)) return;

        let rec = recordsForView.find(r => r.employeeId === emp.id && r.year === year && r.month === month);
        const autoQuota = calculateAnnualQuota(emp.joinDate);

        if (!rec) {
            hasChanges = true;
            const autoRestDays: number[] = [];
            if (isStrictFuture && emp.weeklyRestDays && emp.weeklyRestDays.length > 0) {
                for (let d = 1; d <= daysInMonth; d++) {
                    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                    const dayOfWeek = new Date(year, month - 1, d).getDay();
                    if (annData.customWorkdays.includes(dateStr)) continue;
                    const isStatutory = annData.holidays.some(h => dateStr >= h.startDate && dateStr <= h.endDate);
                    if (isStatutory) continue; 
                    const isNormal = (annData.normalHolidays || []).some(h => dateStr >= h.startDate && dateStr <= h.endDate);
                    if (isNormal) {
                        autoRestDays.push(d);
                        continue;
                    }
                    if (emp.weeklyRestDays.includes(dayOfWeek)) autoRestDays.push(d);
                }
            }
            
            rec = {
                id: Date.now() + Math.random().toString(),
                employeeId: emp.id, year, month,
                restDays: autoRestDays, annualDays: [],
                stats: {
                    springFestival: 0, statutoryHoliday: 0, avgStatutory: '0',
                    annualLeaveQuota: autoQuota, annualLeaveUsed: 0, pastMonthRest: 0, avgMonthRest: '0'
                }
            };
            recordsForView.push(rec);
        } else {
            if (rec.stats.annualLeaveQuota !== autoQuota) {
                rec.stats.annualLeaveQuota = autoQuota;
                hasChanges = true;
            }
        }
        
        const approvedAnnualDays = getApprovedAnnualLeaveDays(emp.id, year, month);
        if (approvedAnnualDays.length > 0) {
            const currentAnnual = rec.annualDays || [];
            const newSet = new Set([...currentAnnual, ...approvedAnnualDays]);
            const mergedAnnual = Array.from(newSet);
            if (mergedAnnual.length !== currentAnnual.length) {
                rec.annualDays = mergedAnnual;
                rec.restDays = rec.restDays.filter(d => !mergedAnnual.includes(d));
                hasChanges = true;
            }
        }
    });
    
    recordsForView.forEach(rec => {
        if (rec.year === year && rec.month === month) {
             rec.stats = calculateStats(rec, annData);
        }
    });
    
    if (hasChanges) StorageService.saveMonthlyLeave(recordsForView);
    setMonthlyRecords(recordsForView);
  };

  const calculateStats = (record: MonthlyLeave, annData: AnnualLeaveYear) => {
      const annualUsed = (record.annualDays || []).length;
      let statTotal = 0;
      annData.holidays.forEach(h => {
          const s = new Date(h.startDate).setHours(0,0,0,0);
          const e = new Date(h.endDate).setHours(0,0,0,0);
          record.restDays.forEach(d => {
              const t = new Date(record.year, record.month - 1, d).getTime();
              if (t >= s && t <= e) statTotal++;
          });
      });
      const allRecs = StorageService.getMonthlyLeave();
      const pastRecs = allRecs.filter(r => r.employeeId === record.employeeId && r.year === record.year && r.month < record.month);
      const pastRestTotal = pastRecs.reduce((sum, r) => sum + (r.restDays?.length || 0), 0);
      const currentRest = record.restDays.length;
      const totalRestYTD = pastRestTotal + currentRest;
      const avgRest = (totalRestYTD / record.month).toFixed(1);
      return {
          ...record.stats, annualLeaveUsed: annualUsed, statutoryHoliday: statTotal, pastMonthRest: pastRestTotal, avgMonthRest: avgRest
      };
  };

  const loadAnnualData = (year: number) => {
    const all = StorageService.getAnnualLeave();
    let found = all.find(y => y.year === year);
    if (!found) {
      found = { 
        year: year, 
        holidays: [], normalHolidays: [], customWorkdays: [], slots: [], historyStats: {} 
      };
    }
    setAnnualData(found);
  };

  const getDayType = (dateStr: string): DayType => {
    if (!annualData) return 'WORK';
    return getDayTypeStatic(dateStr, annualData);
  };

  const getDayTypeColor = (type: DayType) => {
      switch(type) {
          case 'STATUTORY': return 'bg-red-50 text-red-800 border-red-100';
          case 'NORMAL_HOLIDAY':
          case 'WEEKEND': return 'bg-green-50 text-green-800 border-green-100';
          case 'WORK': return 'bg-white text-slate-700';
      }
  };

  const getYearlyHolidayStats = (empId: string) => {
      if (!annualData) return {};
      const year = monthDate.getFullYear();
      const allMonthly = StorageService.getMonthlyLeave().filter(r => r.year === year && r.employeeId === empId);
      const breakdown: Record<string, number> = {};
      annualData.holidays.forEach(h => {
          let count = 0;
          const hStart = new Date(h.startDate);
          const hEnd = new Date(h.endDate);
          const sTime = hStart.setHours(0,0,0,0);
          const eTime = hEnd.setHours(0,0,0,0);
          allMonthly.forEach(record => {
              record.restDays.forEach(day => {
                  const currentDate = new Date(record.year, record.month - 1, day);
                  const cTime = currentDate.getTime();
                  if (cTime >= sTime && cTime <= eTime) count++;
              });
          });
          breakdown[h.id] = count;
      });
      return breakdown;
  };

  const calculateHolidayBreakdown = (empId: string) => {
     return getYearlyHolidayStats(empId);
  };

  const getDaysInMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const getWeekdayLabel = (year: number, month: number, day: number) => {
    const date = new Date(year, month - 1, day);
    const map = ['日', '一', '二', '三', '四', '五', '六'];
    return map[date.getDay()];
  };

  const handleMonthlyCellClick = (empId: string, day: number) => {
    if (isMonthLocked()) return window.alert("该月份已锁定，无法修改。请解锁后操作。");
    
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayType = getDayType(dateStr);

    let newRecords = [...monthlyRecords];
    let record = newRecords.find(r => r.employeeId === empId && r.year === year && r.month === month);
    
    if (record) {
        const isRest = record.restDays.includes(day);
        const isAnnual = record.annualDays?.includes(day);
        let newRest = [...record.restDays];
        let newAnnual = [...(record.annualDays || [])];

        if (!isRest && !isAnnual) {
            newRest.push(day); 
        } else if (isRest) {
            newRest = newRest.filter(d => d !== day);
            if (dayType === 'STATUTORY') {
                window.alert("法定节假日不可标记为年假！");
            } else {
                newAnnual.push(day);
            }
        } else if (isAnnual) {
            newAnnual = newAnnual.filter(d => d !== day); 
        }
        const updatedRec = { ...record, restDays: newRest, annualDays: newAnnual };
        updatedRec.stats = calculateStats(updatedRec, annualData!);
        const idx = newRecords.indexOf(record);
        newRecords[idx] = updatedRec;
        setMonthlyRecords(newRecords);
    }
  };

  const saveMonthly = () => {
    if (isMonthLocked()) return window.alert("锁定状态下无法保存");
    StorageService.saveMonthlyLeave(monthlyRecords);
    window.alert('月假数据已保存');
  };

  // --- PRINT LOGIC (MODAL) ---
  const openPrintPreview = (content: React.ReactNode, title: string) => {
      setPrintContent(content);
      setPrintTitle(title);
      setPrintModalOpen(true);
  };

  const exportMonthly = () => {
      if (!annualData) return;
      const year = monthDate.getFullYear();
      const month = monthDate.getMonth() + 1;
      const extendedRecords = monthlyRecords.map(r => r);
      ExcelService.exportMonthlyTable(year, month, employees, extendedRecords, getDaysInMonth(monthDate), annualData.holidays);
  };

  const getCumulativeStats = (empId: string, currentYear: number) => {
    const allRecs = StorageService.getMonthlyLeave();
    const ytdRecs = allRecs.filter(r => r.employeeId === empId && r.year === currentYear && r.month <= monthDate.getMonth() + 1);
    const used = ytdRecs.reduce((sum, r) => sum + (r.annualDays?.length || 0), 0);
    return { used };
  };

  const handleSaveHabit = (empId: string, dayVal: number, checked: boolean) => {
      if (dayVal !== 0 && dayVal !== 6) return;
      const emp = employees.find(e => e.id === empId);
      if (!emp) return;
      let currentHabits = emp.weeklyRestDays || [];
      if (checked) {
          if (!currentHabits.includes(dayVal)) currentHabits.push(dayVal);
      } else {
          currentHabits = currentHabits.filter(d => d !== dayVal);
      }
      const updatedEmps = employees.map(e => e.id === empId ? { ...e, weeklyRestDays: currentHabits } : e);
      setEmployees(updatedEmps);
      StorageService.saveEmployees(updatedEmps);
  };

  const saveAnnual = (newData: AnnualLeaveYear) => {
    setAnnualData(newData);
    const all = StorageService.getAnnualLeave();
    const others = all.filter(y => y.year !== newData.year);
    StorageService.saveAnnualLeave([...others, newData]);
  };

  const checkDateConflict = (newStart: string, newEnd: string, ignoreId?: string): string | null => {
      if (!annualData) return null;
      const checkStart = new Date(newStart).getTime();
      const checkEnd = new Date(newEnd).getTime();
      
      for (const h of annualData.holidays) {
          if (ignoreId && h.id === ignoreId) continue;
          const s = new Date(h.startDate).getTime();
          const e = new Date(h.endDate).getTime();
          if (Math.max(checkStart, s) <= Math.min(checkEnd, e)) return `法定节假日: ${h.name}`;
      }
      for (const h of annualData.normalHolidays) {
          if (ignoreId && h.id === ignoreId) continue;
          const s = new Date(h.startDate).getTime();
          const e = new Date(h.endDate).getTime();
          if (Math.max(checkStart, s) <= Math.min(checkEnd, e)) return `正常节假日: ${h.name}`;
      }
      for (const d of annualData.customWorkdays) {
          const t = new Date(d).getTime();
          if (t >= checkStart && t <= checkEnd) return `自定义工作日: ${d}`;
      }
      return null;
  };

  const onStatDateChange = (field: 'startDate' | 'endDate', val: string) => {
      setNewStatHoliday(prev => {
          const newData = { ...prev, [field]: val };
          if (field === 'startDate' && !prev.endDate) newData.endDate = val;
          return newData;
      });
  };
  
  const onNormalDateChange = (field: 'startDate' | 'endDate', val: string) => {
      setNewNormalHoliday(prev => {
          const newData = { ...prev, [field]: val };
          if (field === 'startDate' && !prev.endDate) newData.endDate = val;
          return newData;
      });
  };

  // Smart Defaults for Holidays
  const getHolidayDefaultDates = (name: string, year: number) => {
      switch(name) {
          case '元旦节': return { s: `${year}-01-01`, e: `${year}-01-01` };
          case '春节': return { s: `${year}-02-01`, e: `${year}-02-01` };
          case '清明节': return { s: `${year}-04-04`, e: `${year}-04-04` };
          case '劳动节': return { s: `${year}-05-01`, e: `${year}-05-01` };
          case '端午节': return { s: `${year}-06-01`, e: `${year}-06-01` };
          case '中秋节': return { s: `${year}-09-01`, e: `${year}-09-01` };
          case '国庆节': return { s: `${year}-10-01`, e: `${year}-10-01` };
          default: return null;
      }
  };

  const handleStatNameChange = (val: string) => {
      const defaults = getHolidayDefaultDates(val, annualYearVal);
      if (defaults) {
          setNewStatHoliday({ name: val, customName: '', startDate: defaults.s, endDate: defaults.e });
      } else {
          setNewStatHoliday(prev => ({ ...prev, name: val }));
      }
  };

  const handleAddStatHoliday = () => {
      if (!annualData) return;
      const { name, customName, startDate, endDate } = newStatHoliday;
      const finalName = name === '自定义' ? customName : name;
      if (!finalName || !startDate || !endDate) return window.alert('请完整填写信息');
      if (startDate > endDate) return window.alert('开始日期不能晚于结束日期');
      
      const conflict = checkDateConflict(startDate, endDate);
      if (conflict) return window.alert(`日期冲突！与 [${conflict}] 重叠，请调整。`);

      const newHol: StatutoryHoliday = { id: `h_${Date.now()}`, name: finalName, startDate, endDate };
      saveAnnual({ ...annualData, holidays: [...annualData.holidays, newHol] });
      setNewStatHoliday({ ...newStatHoliday, name: '', startDate: '', endDate: '', customName: '' });
  };

  const handleAddNormalHoliday = () => {
      if (!annualData) return;
      const { startDate, endDate } = newNormalHoliday;
      if (!startDate || !endDate) return window.alert('请选择日期范围');
      if (startDate > endDate) return window.alert('开始日期不能晚于结束日期');

      const conflict = checkDateConflict(startDate, endDate);
      if (conflict) return window.alert(`日期冲突！与 [${conflict}] 重叠，请调整。`);

      const newHol: StatutoryHoliday = { id: `nh_${Date.now()}`, name: '正常节假日', startDate, endDate };
      saveAnnual({ ...annualData, normalHolidays: [...annualData.normalHolidays, newHol] });
      // Reset to today
      const t = new Date().toISOString().split('T')[0];
      setNewNormalHoliday({ startDate: t, endDate: t });
  };

  const handleAddCustomWorkday = () => {
      if (!annualData || !newCustomWorkday) return;
      const conflict = checkDateConflict(newCustomWorkday, newCustomWorkday);
      if (conflict) return window.alert(`日期冲突！与 [${conflict}] 重叠，请调整。`);

      saveAnnual({ ...annualData, customWorkdays: [...annualData.customWorkdays, newCustomWorkday].sort() });
      setNewCustomWorkday(new Date().toISOString().split('T')[0]);
  };

  // MODIFIED: Get History Count with Exclusive Logic for Major Holidays
  const getHistoryCount = (empId: string, key: string, targetYearData?: AnnualLeaveYear | null) => {
      const data = targetYearData || annualData;
      if (!data) return 0;
      
      const manualCount = data.historyStats?.[empId]?.[key] || 0;
      let slotCount = 0;
      if (data.slots) {
          data.slots.forEach(slot => {
              if (slot.approved.includes(empId)) {
                  // Determine the bucket for this slot
                  let slotKey = `m_${slot.dominantMonth}`; // Default to Month bucket

                  if (slot.relatedHolidayId) {
                      const h = data.holidays.find(hx => hx.id === slot.relatedHolidayId);
                      if (h) {
                          // Only count as a "Holiday" stat if it is one of the Big 3
                          // Otherwise, it counts as a Month stat (default)
                          if (MAJOR_HOLIDAYS.some(major => h.name.includes(major))) {
                              slotKey = slot.relatedHolidayId; 
                          }
                      }
                  }
                  
                  // If the slot's determined bucket matches the requested key, increment
                  if (slotKey === key) slotCount++;
              }
          });
      }
      return manualCount + slotCount;
  };

  const updateHistoryCount = (empId: string, key: string, val: number) => {
    if (!isPredeclareUnlocked) return;
    if (!annualData) return;
    const stats = { ...annualData.historyStats };
    if (!stats[empId]) stats[empId] = {};
    
    // Need to subtract live count to set base manual count correctly
    let slotCount = 0;
    if (annualData.slots) {
        annualData.slots.forEach(slot => {
            if (slot.approved.includes(empId)) {
                // Same logic as getHistoryCount to determine if this slot contributes to 'key'
                let slotKey = `m_${slot.dominantMonth}`;
                if (slot.relatedHolidayId) {
                     const h = annualData.holidays.find(hx => hx.id === slot.relatedHolidayId);
                     if (h && MAJOR_HOLIDAYS.some(major => h.name.includes(major))) {
                         slotKey = slot.relatedHolidayId;
                     }
                }
                if (slotKey === key) slotCount++;
            }
        });
    }
    const newBase = val - slotCount;
    stats[empId][key] = newBase;
    saveAnnual({ ...annualData, historyStats: stats });
  };

  const handleHistoryImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isPredeclareUnlocked) return window.alert("请先解锁预申报");
    const file = e.target.files?.[0];
    if (!file || !annualData) return;
    try {
        const { header, rows } = await ExcelService.readHistoryExcel(file);
        let updatedStats = { ...annualData.historyStats };
        let mergeCount = 0;
        rows.forEach(row => {
            const empId = String(row[0] || '');
            if (!employees.find(e => e.id === empId)) return;
            if (!updatedStats[empId]) updatedStats[empId] = {};
            for (let i = 2; i < header.length; i++) {
                const colName = header[i];
                const val = Number(row[i]) || 0;
                if (val === 0) continue;
                let key = '';
                if (colName.endsWith('月')) {
                    const m = parseInt(colName.replace('月',''));
                    if (!isNaN(m)) key = `m_${m}`;
                } else {
                    const h = annualData.holidays.find(h => h.name === colName);
                    if (h) key = h.id;
                }
                if (key) updatedStats[empId][key] = (updatedStats[empId][key] || 0) + val;
            }
            mergeCount++;
        });
        saveAnnual({ ...annualData, historyStats: updatedStats });
        window.alert(`成功合并 ${mergeCount} 条数据`);
    } catch (err) { window.alert('导入失败'); }
    if (historyFileInputRef.current) historyFileInputRef.current.value = '';
  };

  const findConnectedStatutoryHoliday = (date: Date, direction: 'prev' | 'next'): string | undefined => {
      if (!annualData) return undefined;
      let currentCheck = new Date(date);
      for (let i = 0; i < 30; i++) {
          currentCheck.setDate(currentCheck.getDate() + (direction === 'prev' ? -1 : 1));
          const checkStr = currentCheck.toISOString().split('T')[0];
          const dayType = getDayTypeStatic(checkStr, annualData);

          if (dayType === 'STATUTORY') {
               const statHoliday = annualData.holidays.find(h => checkStr >= h.startDate && checkStr <= h.endDate);
               if (statHoliday) {
                   if (MAJOR_HOLIDAYS.some(n => statHoliday.name.includes(n))) {
                       return statHoliday.id;
                   }
               }
               return undefined;
          }
          if (dayType === 'NORMAL_HOLIDAY' || dayType === 'WEEKEND') continue; 
          if (dayType === 'WORK') return undefined;
      }
      return undefined;
  };

  const generateYearlySlots = () => {
    if (!isPredeclareUnlocked) return window.alert("请先解锁");
    if (!annualData) return;
    const slots: AnnualLeaveSlot[] = [];
    const year = annualData.year;
    const startDate = new Date(year, 0, 1);
    const endDate = new Date(year, 11, 31);
    let currentSlotStart: Date | null = null;
    let currentSlotEnd: Date | null = null;
    
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
        const dateStr = cursor.toISOString().split('T')[0];
        const dayType = getDayTypeStatic(dateStr, annualData);
        const isWorkSlot = dayType === 'WORK';

        if (isWorkSlot) {
            if (!currentSlotStart) currentSlotStart = new Date(cursor);
            currentSlotEnd = new Date(cursor);
        } else {
            if (currentSlotStart && currentSlotEnd) {
                createSlot(slots, currentSlotStart, currentSlotEnd, false);
                currentSlotStart = null; currentSlotEnd = null;
            }
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    if (currentSlotStart && currentSlotEnd) createSlot(slots, currentSlotStart, currentSlotEnd, false);

    annualData.holidays.forEach(h => {
        const start = new Date(h.startDate);
        const end = new Date(h.endDate);
        if (start.getFullYear() === year) {
            createSlot(slots, start, end, true, h.id);
        }
    });

    saveAnnual({ ...annualData, slots: slots });
    window.alert("工作日区间已重置并重新计算！");
  };

  const createSlot = (slots: AnnualLeaveSlot[], start: Date, end: Date, isHolidayBlock: boolean = false, holidayId?: string) => {
      if (!annualData) return;
      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];
      const startMonth = start.getMonth() + 1;
      const endMonth = end.getMonth() + 1;
      let dominantMonth = startMonth;
      
      if (startMonth !== endMonth) {
          const startCopy = new Date(start);
          let dStart = 0;
          while(startCopy.getMonth() + 1 === startMonth) {
             dStart++;
             startCopy.setDate(startCopy.getDate() + 1);
          }
          const totalDays = Math.round((end.getTime() - start.getTime()) / (1000*3600*24)) + 1;
          if ((totalDays - dStart) > dStart) dominantMonth = endMonth;
      }
      
      let relatedHolidayId = holidayId;
      if (!isHolidayBlock) {
          const prevConnect = findConnectedStatutoryHoliday(start, 'prev');
          if (prevConnect) relatedHolidayId = prevConnect;
          else {
              const nextConnect = findConnectedStatutoryHoliday(end, 'next');
              if (nextConnect) relatedHolidayId = nextConnect;
          }
      }

      slots.push({
          id: `gen_${startStr}_${Math.random().toString().substr(2,4)}`, 
          startDate: startStr, endDate: endStr, dominantMonth,
          relatedHolidayId, 
          limit: isHolidayBlock ? 0 : (dominantMonth <= 6 ? 5 : 4),
          applicants: [], approved: [],
          customLimit: false 
      });
  };

  const handleAddSlot = () => {
    if (!isPredeclareUnlocked) return window.alert("请先解锁");
    if (!annualData) return;
    
    const newSlot: AnnualLeaveSlot = {
        id: `manual_${Date.now()}`,
        startDate: new Date().toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        dominantMonth: new Date().getMonth() + 1,
        limit: 5,
        applicants: [],
        approved: [],
        customLimit: false
    };

    const newSlots = [...annualData.slots, newSlot];
    saveAnnual({ ...annualData, slots: newSlots });
  };

  const updateSlot = (id: string, updates: Partial<AnnualLeaveSlot>) => {
    if (!isPredeclareUnlocked) return;
    if (!annualData) return;
    const newSlots = annualData.slots.map(s => {
        if (s.id === id) {
            const updated = { ...s, ...updates };
            if (updates.limit !== undefined) updated.customLimit = true;
            return updated;
        }
        return s;
    });
    saveAnnual({ ...annualData, slots: newSlots });
  };

  const addCandidate = (slotId: string) => {
      if (!isPredeclareUnlocked) return window.alert("请先解锁");
      if (!annualData) return;
      const slot = annualData.slots.find(s => s.id === slotId);
      if (!slot) return;
      if (slot.limit === 0) return window.alert("此区间为法定节假日，不可申报！");
      const empId = candidateInputs[slotId];
      if (!empId) return;
      
      const emp = employees.find(e => e.id === empId);
      if (annualData.year > new Date().getFullYear() && emp?.status !== 'Active') {
          return window.alert("该员工非在职状态，无法申报未来年假");
      }
      if (slot.applicants.includes(empId)) return;
      updateSlot(slotId, { applicants: [...slot.applicants, empId] });
      setCandidateInputs(prev => ({ ...prev, [slotId]: '' }));
      setFoundCandidates(prev => ({ ...prev, [slotId]: '' }));
  };

  const runAutoAllocation = () => {
    if (isPredeclareUnlocked) return window.alert("预申报未锁定，无法执行自动分配！");
    if (!annualData) return;
    const newSlots = annualData.slots.map(slot => {
      if (slot.limit === 0) return slot;
      const priorityKey = slot.relatedHolidayId ? slot.relatedHolidayId : `m_${slot.dominantMonth}`;
      const scored = slot.applicants.map(empId => {
        const count = getHistoryCount(empId, priorityKey);
        return { empId, count, random: Math.random() };
      });
      scored.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        return a.random - b.random;
      });
      return { ...slot, approved: scored.slice(0, slot.limit).map(x => x.empId) };
    });
    saveAnnual({ ...annualData, slots: newSlots });
    window.alert('自动分配完成！');
  };

  // Filter Helper
  const filterSlots = (slots: AnnualLeaveSlot[], filterVal: string) => {
      if (filterVal === '0') return slots;
      // If number, filter by month
      if (!isNaN(Number(filterVal))) {
          return slots.filter(s => s.dominantMonth === Number(filterVal));
      }
      // If string (Holiday Name), filter by matching related holiday name
      const targetHolidayName = filterVal.replace('HOLIDAY_', '');
      return slots.filter(s => {
          const h = annualData?.holidays.find(h => h.id === s.relatedHolidayId);
          return h && h.name.includes(targetHolidayName);
      });
  };

  // --- RENDERERS ---
  // ... renderMonthlyTab unchanged ...
  const renderMonthlyTab = () => {
    const year = monthDate.getFullYear();
    const month = monthDate.getMonth() + 1;
    const daysInMonth = getDaysInMonth(monthDate);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const holidays = annualData?.holidays || [];
    const locked = isMonthLocked();

    const viewEmployees = getFilteredEmployees(year, month);

    return (
        <div className="h-full flex flex-col space-y-2">
            <div className="flex justify-between items-center bg-white p-3 rounded-xl shadow no-print">
                <div className="flex items-center gap-4">
                    <button onClick={() => { const d = new Date(monthDate); d.setMonth(d.getMonth() - 1); setMonthDate(d); }} className="p-1 hover:bg-slate-100 rounded font-bold text-lg">&lt;</button>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        {year}年 {month}月
                        {locked ? <span className="text-red-500 flex items-center gap-1 text-xs font-normal"><Lock size={14}/> 已锁定</span> : <span className="text-green-500 flex items-center gap-1 text-xs font-normal"><Unlock size={14}/> 编辑中</span>}
                    </h3>
                    <button onClick={() => { const d = new Date(monthDate); d.setMonth(d.getMonth() + 1); setMonthDate(d); }} className="p-1 hover:bg-slate-100 rounded font-bold text-lg">&gt;</button>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <div className="h-6 w-px bg-slate-300 mx-2"></div>
                    <button onClick={() => { setHabitSearchId(''); setIsHabitModalOpen(true); }} className="btn-secondary flex items-center gap-2 text-blue-600 border-blue-200">
                        <Clock size={16}/> 休假偏好设置
                    </button>
                    <button onClick={handleMonthLockClick} className={`flex items-center gap-2 px-3 py-1.5 rounded text-white shadow-sm transition-colors text-xs ${locked ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                        {locked ? <><Lock size={14}/> 解锁本月</> : <><Lock size={14}/> 锁定本月</>}
                    </button>
                    <button onClick={() => openPrintPreview(renderMonthlyTab(), `月假安排-${year}-${month}`)} className="btn-secondary flex items-center gap-2">
                        <Printer size={16}/> 打印
                    </button>
                    <button onClick={exportMonthly} className="btn-secondary flex items-center gap-2">
                        <Download size={16}/> 导出
                    </button>
                    <button onClick={saveMonthly} className={`px-4 py-1.5 rounded flex items-center gap-2 shadow-sm text-white text-xs ${locked ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`} disabled={locked}>
                        <Save size={16} /> 保存
                    </button>
                </div>
            </div>

            <div className="vims-table-container bg-white rounded-xl shadow border border-slate-100 flex flex-col h-full">
                <div className="p-2 bg-yellow-50 text-yellow-800 text-xs border-b border-yellow-100 flex justify-center items-center gap-4 no-print font-medium">
                   <span>点击图例:</span>
                   <span className="flex items-center gap-1"><div className="w-3 h-3 border bg-green-500"></div> 休 (法定/正常节假/周末)</span>
                   <span className="flex items-center gap-1"><div className="w-3 h-3 border bg-purple-500"></div> 年 (年假)</span>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-sm border-collapse text-center whitespace-nowrap relative">
                        <thead className="bg-slate-50 text-slate-600 font-semibold sticky top-0 z-20 shadow-sm">
                            <tr>
                                <th rowSpan={2} className="vims-table-header border sticky left-0 bg-slate-50 z-30 min-w-[80px]">工号</th>
                                <th rowSpan={2} className="vims-table-header border sticky left-[80px] bg-slate-50 z-30 min-w-[100px]">姓名</th>
                                {/* REDUCED WIDTH by 15%: Preference Column (min-w-[110px] -> min-w-[94px]) */}
                                <th rowSpan={2} className="vims-table-header border min-w-[94px] bg-slate-50">休假偏好</th>
                                {daysArray.map(d => {
                                    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                                    const type = getDayType(dateStr);
                                    return <th key={`h-${d}`} className={`p-1 border w-10 min-w-[2.5rem] text-xs font-bold ${getDayTypeColor(type)}`}>{getWeekdayLabel(year, month, d)}</th>;
                                })}
                                <th colSpan={holidays.length} className="vims-table-header border bg-orange-50 text-orange-800 text-xs">法定节假日明细 (休)</th>
                                <th colSpan={2} className="vims-table-header border bg-blue-50 text-blue-800 text-xs">当年累计 (年)</th>
                                <th rowSpan={2} className="vims-table-header border min-w-[60px]">往月休</th>
                                <th rowSpan={2} className="vims-table-header border min-w-[60px]">月均休</th>
                            </tr>
                            <tr>
                                {daysArray.map(d => {
                                    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                                    const type = getDayType(dateStr);
                                    return <th key={`d-${d}`} className={`p-1 border w-10 min-w-[2.5rem] cursor-pointer text-sm font-bold ${getDayTypeColor(type)}`}>{d}</th>;
                                })}
                                {holidays.map(h => <th key={h.id} className="p-2 border min-w-[60px] bg-orange-50 text-orange-800 font-bold">{h.name}</th>)}
                                <th className="p-2 border min-w-[60px] bg-blue-50 text-blue-800">总额</th>
                                <th className="p-2 border min-w-[60px] bg-blue-50 text-blue-800">已休</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {viewEmployees.map(emp => {
                                const record = monthlyRecords.find(r => r.employeeId === emp.id && r.year === year && r.month === month);
                                const restDays = record?.restDays || [];
                                const annualDays = record?.annualDays || [];
                                const stats = record?.stats || {
                                    springFestival: 0, statutoryHoliday: 0, avgStatutory: '0',
                                    annualLeaveQuota: 5, annualLeaveUsed: 0, pastMonthRest: 0, avgMonthRest: '0'
                                };
                                const cumulative = getCumulativeStats(emp.id, year);
                                const holidayBreakdown = calculateHolidayBreakdown(emp.id);
                                const habitElements = (emp.weeklyRestDays || []).map(d => {
                                    const label = WEEK_DAYS.find(w=>w.val===d)?.label;
                                    const colorClass = (d === 6 || d === 0) ? 'text-green-600 font-bold' : '';
                                    return <span key={d} className={colorClass}>{label}</span>;
                                });

                                return (
                                    <tr key={emp.id}>
                                        <td className="vims-table-cell border sticky left-0 bg-white font-mono z-10">{emp.id}</td>
                                        <td className="vims-table-cell border sticky left-[80px] bg-white font-medium z-10 shadow-sm">{emp.name}</td>
                                        <td className="vims-table-cell border text-xs text-slate-500">
                                            <div className="flex gap-1 justify-center">{habitElements.length ? habitElements.reduce((prev, curr) => [prev, ', ', curr] as any) : '-'}</div>
                                        </td>
                                        {daysArray.map(d => {
                                            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                                            const type = getDayType(dateStr);
                                            const isRest = restDays.includes(d);
                                            const isAnnual = annualDays.includes(d);
                                            return (
                                                <td 
                                                    key={d} 
                                                    className={`border p-0 cursor-pointer ${isRest ? 'bg-green-500 text-white' : isAnnual ? 'bg-purple-500 text-white' : `${getDayTypeColor(type)}`}`}
                                                    onClick={() => handleMonthlyCellClick(emp.id, d)}
                                                >
                                                    <div className="w-full h-full min-h-[2rem] flex items-center justify-center text-base font-bold">
                                                        {isRest ? '休' : isAnnual ? '年' : ''}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                        
                                        {holidays.map(h => (
                                            <td key={h.id} className="border p-1 text-center bg-orange-50/30 font-bold text-orange-700 text-base">
                                                {fmtZero(holidayBreakdown[h.id])}
                                            </td>
                                        ))}

                                        <td className="border p-0"><input disabled={true} type="number" className="w-full h-full p-0 text-center outline-none bg-slate-50 font-bold text-slate-700 text-base" value={fmtZero(stats.annualLeaveQuota)} readOnly /></td>
                                        <td className="border p-0 text-center bg-blue-50/30 relative">
                                             <div className="flex items-center justify-center h-full font-bold text-purple-700 text-base">
                                                 {fmtZero(stats.annualLeaveUsed)}
                                                 <span className="absolute top-0 right-0 text-[10px] bg-purple-200 text-purple-800 px-1 py-0 rounded-bl" title="当年累计已休">{cumulative.used}</span>
                                             </div>
                                        </td>
                                        <td className="border p-0 text-center text-slate-600 text-base font-medium">{fmtZero(stats.pastMonthRest)}</td>
                                        <td className="border p-0 text-center font-bold text-blue-600 text-base">{fmtZero(stats.avgMonthRest)}</td>
                                    </tr>
                                );
                            })}
                            {viewEmployees.length === 0 && <tr><td colSpan={40} className="p-6 text-center text-slate-400 text-sm">当前月份无在职员工数据</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
  };

  // Helper for rendering filters
  const renderMonthFilterOptions = () => (
      <>
        <option value="0">显示全部</option>
        <optgroup label="重要节假日">
            <option value="HOLIDAY_春节">春节</option>
            <option value="HOLIDAY_劳动节">劳动节</option>
            <option value="HOLIDAY_国庆节">国庆节</option>
        </optgroup>
        <optgroup label="月份">
            {Array.from({length: 12}).map((_, i) => <option key={i+1} value={String(i+1)}>{i+1}月</option>)}
        </optgroup>
      </>
  );

  const renderCumulativeTab = () => {
      const allYears = StorageService.getAnnualLeave();
      const effectiveYears = allYears.map(y => {
          if (annualData && y.year === annualData.year) return annualData;
          return y;
      });
      if (annualData && !effectiveYears.find(y => y.year === annualData.year)) {
          effectiveYears.push(annualData);
      }
      // FILTER: Only show Major Holidays in stats table to avoid duplicates
      const statsHolidays = annualData?.holidays.filter(h => MAJOR_HOLIDAYS.some(m => h.name.includes(m))) || [];

      const yearList = Array.from({length: 2099 - 1997 + 1}, (_, i) => 1997 + i);
      const getAggregated = (empId: string, key: string) => {
          let total = 0;
          effectiveYears.forEach(y => {
              if (y.year >= statStartYear && y.year <= statEndYear) {
                 total += getHistoryCount(empId, key, y);
              }
          });
          return total;
      };

      return (
          <div className="vims-table-container bg-white rounded-xl shadow overflow-hidden h-full flex flex-col">
              <div className="p-4 border-b bg-slate-50 flex justify-between items-center no-print">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2"><BarChart3 size={20} className="text-purple-600"/> 累计年假统计 (区间筛选)</h3>
                  </div>
                  <div className="flex items-center gap-4">
                      <button onClick={() => openPrintPreview(renderCumulativeTab(), '累计年假统计')} className="btn-secondary flex items-center gap-2">
                         <Printer size={16}/> 打印
                      </button>
                      <div className="flex items-center gap-2 bg-white p-2 rounded border shadow-sm">
                          <span className="text-sm text-slate-600 font-medium"><Filter size={14} className="inline mr-1"/>年份范围:</span>
                          <select className="border rounded p-1 text-sm" value={statStartYear} onChange={e => setStatStartYear(Number(e.target.value))}>
                            {yearList.map(y => <option key={y} value={y}>{y}年</option>)}
                          </select>
                          <span className="text-slate-400 text-sm">至</span>
                          <select className="border rounded p-1 text-sm" value={statEndYear} onChange={e => setStatEndYear(Number(e.target.value))}>
                            {yearList.map(y => <option key={y} value={y}>{y}年</option>)}
                          </select>
                      </div>
                  </div>
              </div>
              <div className="flex-1 overflow-auto">
                   <table className="w-full text-sm border-collapse text-center whitespace-nowrap">
                        <thead className="bg-purple-50 text-purple-900 sticky top-0 z-10">
                            <tr>
                                <th className="vims-table-header border min-w-[80px] w-[80px]">工号</th>
                                <th className="vims-table-header border min-w-[100px] w-[100px]">姓名</th>
                                {/* Uniform Widths for Stats Columns: min-w-[80px] */}
                                {Array.from({length: 12}).map((_,i)=> <th key={i} className="vims-table-header border min-w-[80px] w-[80px]">{i+1}月</th>)}
                                {statsHolidays.map(h => <th key={h.id} className="vims-table-header border text-orange-800 min-w-[80px] w-[80px]">{h.name}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {employees.map(emp => {
                                return (
                                <tr key={emp.id}>
                                    <td className="vims-table-cell border font-mono text-sm text-slate-500">{emp.id}</td>
                                    <td className="vims-table-cell border font-bold">{emp.name}</td>
                                    {Array.from({length: 12}).map((_,i) => (
                                        <td key={i} className="vims-table-cell border font-medium text-base">{fmtZero(getAggregated(emp.id, `m_${i+1}`))}</td>
                                    ))}
                                    {statsHolidays.map(h => (
                                        <td key={h.id} className="vims-table-cell border text-orange-700 bg-orange-50/30 font-bold text-base">{fmtZero(getAggregated(emp.id, h.id))}</td>
                                    ))}
                                </tr>
                            )})}
                        </tbody>
                   </table>
              </div>
          </div>
      );
  };

  const renderHistoryTab = () => {
      // FILTER: Only show Major Holidays in stats table
      const statsHolidays = annualData?.holidays.filter(h => MAJOR_HOLIDAYS.some(m => h.name.includes(m))) || [];
      
      return (
      <div className="vims-table-container bg-white rounded-xl shadow overflow-hidden">
             <div className="p-3 border-b bg-slate-50 flex justify-between items-center no-print">
                <div>
                    <h3 className="font-bold text-lg mb-1 flex items-center gap-2">
                        {annualData?.year}年 历史统计 (含申报结果)
                        {isPredeclareUnlocked ? <span className="text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded"><Unlock size={14} className="inline mr-1"/>编辑中</span> : <span className="text-slate-500 text-xs bg-slate-100 px-2 py-0.5 rounded"><Lock size={14} className="inline mr-1"/>已锁定</span>}
                    </h3>
                    <p className="text-xs text-slate-500">统计数据自动包含“申报结果”中的获批次数。手动修改将调整基础值。</p>
                </div>
                <div className="flex gap-2">
                     <button onClick={() => openPrintPreview(renderHistoryTab(), '历史统计')} className="btn-secondary flex items-center gap-2">
                        <Printer size={16}/> 打印
                     </button>
                     <button onClick={() => ExcelService.downloadTemplate('HISTORY_STATS')} className="btn-secondary flex items-center gap-2">
                        <FileSpreadsheet size={16}/> 模板
                     </button>
                     <button onClick={() => historyFileInputRef.current?.click()} disabled={!isPredeclareUnlocked} className="btn-secondary flex items-center gap-2 disabled:opacity-50">
                        <Upload size={16}/> 导入
                     </button>
                     <input type="file" ref={historyFileInputRef} onChange={handleHistoryImport} className="hidden" accept=".xlsx, .xls" />
                     <button onClick={() => annualData && ExcelService.exportHistoryStats(employees, annualData)} className="btn-secondary flex items-center gap-2">
                        <Download size={16}/> 导出
                     </button>
                </div>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse text-center whitespace-nowrap">
                <thead>
                <tr className="bg-slate-100">
                    <th className="vims-table-header border sticky left-0 bg-slate-100 z-10 min-w-[80px] w-[80px]">工号</th>
                    <th className="vims-table-header border sticky left-[80px] bg-slate-100 z-10 min-w-[130px] w-[130px]">姓名</th>
                    {/* Uniform Widths for Stats Columns */}
                    {Array.from({length:12}).map((_,i) => <th key={i} className="vims-table-header border min-w-[80px] w-[80px]">{i+1}月</th>)}
                    {statsHolidays.map(h => <th key={h.id} className="vims-table-header border bg-orange-50 min-w-[80px] w-[80px] text-orange-800">{h.name}</th>)}
                </tr>
                </thead>
                <tbody>
                    {employees.map(emp => (
                        <tr key={emp.id}>
                            <td className="vims-table-cell border sticky left-0 bg-white font-mono text-slate-500">{emp.id}</td>
                            <td className="vims-table-cell border sticky left-[80px] bg-white font-medium">{emp.name}</td>
                            {Array.from({length: 12}).map((_, i) => (
                                <td key={i} className="vims-table-cell border p-0">
                                    <input 
                                        disabled={!isPredeclareUnlocked}
                                        type="number" 
                                        className="w-full h-full text-center outline-none focus:bg-blue-50 disabled:bg-transparent"
                                        value={fmtZero(getHistoryCount(emp.id, `m_${i+1}`))}
                                        onChange={e => updateHistoryCount(emp.id, `m_${i+1}`, +e.target.value)}
                                    />
                                </td>
                            ))}
                            {statsHolidays.map(h => (
                                <td key={h.id} className="vims-table-cell border p-0 bg-orange-50/30">
                                    <input 
                                        disabled={!isPredeclareUnlocked}
                                        type="number" 
                                        className="w-full h-full text-center outline-none focus:bg-orange-100 bg-transparent font-bold text-slate-700 disabled:bg-transparent"
                                        value={fmtZero(getHistoryCount(emp.id, h.id))}
                                        onChange={e => updateHistoryCount(emp.id, h.id, +e.target.value)}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>
        </div>
      );
  };

  const renderPredeclareTab = () => (
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl shadow flex flex-col xl:flex-row justify-between items-center no-print gap-4">
            <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                    年假预申报表
                    {isPredeclareUnlocked ? <span className="text-green-500 text-sm font-normal flex items-center gap-1"><Unlock size={16}/> 编辑模式</span> : <span className="text-red-500 text-sm font-normal flex items-center gap-1"><Lock size={16}/> 已锁定</span>}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">灰色区间为法定/正常节假日(不可申报)。共 {annualData?.slots.length} 个区间。</p>
            </div>

            {/* CONTROL BAR */}
            <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-lg border border-slate-200">
                {/* 1. Reset Button */}
                <button 
                    onClick={generateYearlySlots} 
                    disabled={!isPredeclareUnlocked} 
                    className={`flex items-center gap-2 px-3 py-1 rounded-md font-bold text-sm shadow-sm transition-all ${isPredeclareUnlocked ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200 border border-indigo-300' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                    title="根据当前日期定义重新生成区间"
                >
                    <ListRestart size={16} />
                    <span className="hidden md:inline">重置/更新区间</span>
                </button>

                {/* 2. Filter */}
                <div className="flex items-center gap-1 px-2 border-r border-slate-300">
                    <Filter size={14} className="text-slate-500"/>
                    <span className="text-xs font-bold text-slate-700">归属月:</span>
                    <select 
                        className="border rounded p-1 text-sm font-medium w-24" 
                        value={predeclareMonthFilter} 
                        onChange={e => { setPredeclareMonthFilter(e.target.value); /* Removed selection clearing */ }}
                    >
                        {renderMonthFilterOptions()}
                    </select>
                </div>
            </div>

            <div className="flex gap-2">
                <button onClick={() => openPrintPreview(renderPredeclareTab(), '年假预申报表')} className="btn-secondary flex items-center gap-2">
                    <Printer size={16}/> 打印
                </button>
                <button onClick={handleAnnualLockClick} className={`flex items-center gap-2 px-3 py-1.5 rounded text-white shadow-sm transition-colors text-sm ${isPredeclareUnlocked ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}>
                    {isPredeclareUnlocked ? '锁定申报' : '解锁编辑'}
                </button>
                <button onClick={handleAddSlot} disabled={!isPredeclareUnlocked} className={`bg-blue-600 text-white px-4 py-1.5 rounded flex items-center gap-2 text-sm ${!isPredeclareUnlocked && 'opacity-50 cursor-not-allowed'}`}>
                    <Plus size={16}/> 添加区间
                </button>
            </div>
        </div>
        
        <div className="vims-table-container bg-white rounded-xl shadow h-[calc(100vh-180px)] overflow-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead className="sticky top-0 z-10 bg-white shadow-sm">
                    <tr className="bg-slate-100 text-slate-600">
                        <th className="vims-table-header border w-32">法定节假关联</th>
                        <th className="vims-table-header border w-20">归属月</th>
                        <th className="vims-table-header border min-w-[200px]">工作日区间 (不含周末/节假日)</th>
                        {/* REDUCED WIDTH by 10%: Limit (w-32 -> w-28) */}
                        <th className="vims-table-header border w-28">限额</th>
                        {/* REDUCED WIDTH by 20%: Input (w-[17rem] -> w-56 approx 14rem) */}
                        <th className="vims-table-header border w-56">申报输入</th>
                        {/* EXPANDED WIDTH: List (w-[42%] -> flex-1 equivalent logic, let table layout handle remaining space) */}
                        <th className="vims-table-header border min-w-[400px]">申报人员名单</th>
                        <th className="vims-table-header border w-16 no-print">操作</th>
                    </tr>
                </thead>
                <tbody>
                    {filterSlots(annualData?.slots || [], predeclareMonthFilter)
                        .sort((a,b)=>a.startDate.localeCompare(b.startDate))
                        .map(slot => {
                        const holidayName = annualData.holidays.find(h => h.id === slot.relatedHolidayId)?.name;
                        const isBlock = slot.limit === 0;

                        return (
                            <tr key={slot.id} className={`border-b last:border-0 ${isBlock ? 'bg-slate-100 text-slate-400' : ''}`}>
                                <td className="vims-table-cell border">
                                        <select 
                                        disabled={!isPredeclareUnlocked || isBlock}
                                        className={`w-full border rounded p-1 text-sm ${holidayName ? 'bg-orange-100 text-orange-800 border-orange-300 font-bold' : isBlock ? 'bg-transparent' : 'text-slate-400'}`}
                                        value={slot.relatedHolidayId || ''}
                                        onChange={e => updateSlot(slot.id, { relatedHolidayId: e.target.value || undefined })}
                                        >
                                            <option value="">- 无 -</option>
                                            {annualData?.holidays.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
                                        </select>
                                </td>
                                <td className="vims-table-cell border text-center font-bold text-sm">
                                    {slot.dominantMonth}月
                                </td>
                                <td className="vims-table-cell border">
                                    <div className="flex items-center gap-2">
                                        <input disabled={!isPredeclareUnlocked || isBlock} type="date" className="border rounded p-1 text-sm" value={slot.startDate} onChange={e => { updateSlot(slot.id, {startDate: e.target.value}); }} />
                                        <span className="text-slate-400 font-bold">-</span>
                                        <input disabled={!isPredeclareUnlocked || isBlock} type="date" className="border rounded p-1 text-sm" value={slot.endDate} onChange={e => { updateSlot(slot.id, {endDate: e.target.value}); }} />
                                        {isBlock && <span className="text-xs bg-red-100 text-red-500 px-1.5 py-0.5 rounded font-bold">法定节假日</span>}
                                    </div>
                                </td>
                                <td className="vims-table-cell border">
                                    <input 
                                        disabled={!isPredeclareUnlocked || isBlock} 
                                        type="number" 
                                        className={`w-full border rounded p-1 text-center font-bold text-sm ${slot.customLimit ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : ''}`} 
                                        value={slot.limit} 
                                        onChange={e => updateSlot(slot.id, { limit: +e.target.value })} 
                                        title={slot.customLimit ? "独立设置限额" : "全局默认限额"}
                                    />
                                </td>
                                <td className="vims-table-cell border bg-slate-50/50">
                                    <div className="flex gap-2 items-center p-1 no-print">
                                        <input 
                                            disabled={!isPredeclareUnlocked || isBlock}
                                            type="text" 
                                            placeholder={isBlock ? "不可申报" : "工号"} 
                                            className="border rounded p-1 w-full text-center outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-300 text-sm"
                                            value={candidateInputs[slot.id] || ''}
                                            onChange={e => { setCandidateInputs(prev => ({ ...prev, [slot.id]: e.target.value })); setFoundCandidates(prev => ({ ...prev, [slot.id]: employees.find(em=>em.id===e.target.value)?.name || '' })) }}
                                            onKeyDown={e => e.key === 'Enter' && addCandidate(slot.id)}
                                        />
                                        <button onClick={() => addCandidate(slot.id)} className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 disabled:opacity-50 text-xs whitespace-nowrap" disabled={!isPredeclareUnlocked || !foundCandidates[slot.id] || isBlock}>
                                            <Plus size={16}/> 添加
                                        </button>
                                    </div>
                                    {foundCandidates[slot.id] && <div className="text-xs text-green-600 font-bold text-center mt-1">{foundCandidates[slot.id]}</div>}
                                </td>

                                <td className="vims-table-cell border">
                                    <div className="flex flex-wrap gap-2 p-1 max-h-24 overflow-y-auto">
                                        {slot.applicants.map(empId => (
                                            <div key={empId} className="px-3 py-1.5 rounded-md text-base border flex items-center gap-2 bg-white border-slate-200 text-slate-700 shadow-sm">
                                                <span className="font-medium">{employees.find(e => e.id === empId)?.name}</span>
                                                {isPredeclareUnlocked && <button onClick={() => updateSlot(slot.id, { applicants: slot.applicants.filter(id => id !== empId) })} className="text-slate-400 hover:text-red-500 ml-1 no-print"><X size={14}/></button>}
                                            </div>
                                        ))}
                                        {slot.applicants.length === 0 && !isBlock && <span className="text-slate-300 text-sm italic p-1">暂无申报人员</span>}
                                    </div>
                                </td>
                                <td className="vims-table-cell border text-center no-print">
                                    <button disabled={!isPredeclareUnlocked} onClick={() => { const newS = annualData!.slots.filter(s=>s.id!==slot.id); saveAnnual({...annualData!, slots: newS}); }} className="text-slate-400 hover:text-red-600 disabled:opacity-50"><Trash2 size={18}/></button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    </div>
  );

  const renderResultTab = () => (
      <div className="bg-white rounded-xl shadow overflow-hidden h-full flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-slate-50 no-print">
            <div className="flex items-center gap-6">
                <div>
                    <h3 className="font-bold text-lg">年假申报结果 & 分配</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                        {isPredeclareUnlocked ? <span className="text-red-500 font-bold">预申报处于解锁状态，请先锁定后再执行自动分配。</span> : "自动分配功能就绪。"}
                    </p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded border border-slate-200">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1"><Filter size={14}/>归属月筛选:</span>
                    <select 
                        className="border rounded p-1 text-sm font-medium w-28 bg-white" 
                        value={resultMonthFilter} 
                        onChange={e => setResultMonthFilter(e.target.value)}
                    >
                        {renderMonthFilterOptions()}
                    </select>
                </div>
            </div>
            <div className="flex gap-2">
                    <button onClick={() => openPrintPreview(renderResultTab(), '年假分配结果')} className="btn-secondary flex items-center gap-2">
                        <Printer size={16}/> 打印
                    </button>
                    <button onClick={runAutoAllocation} disabled={isPredeclareUnlocked} className={`bg-green-600 text-white px-4 py-2 rounded shadow flex items-center gap-2 text-sm font-bold ${isPredeclareUnlocked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-green-700'}`}>
                        <Trophy size={18} /> 执行自动分配
                    </button>
            </div>
        </div>
        <div className="p-4 overflow-y-auto flex-1 bg-slate-100">
            <div className="grid grid-cols-1 gap-4">
                {filterSlots(annualData?.slots || [], resultMonthFilter)
                    .filter(s => s.limit > 0)
                    .map(slot => {
                    const holidayName = annualData.holidays.find(h => h.id === slot.relatedHolidayId)?.name;
                    const label = holidayName ? `${holidayName} (连休)` : `${slot.dominantMonth}月`;
                    const labelColor = holidayName ? 'bg-orange-600' : 'bg-blue-600';
                    const approvedList = slot.approved;
                    const eliminatedList = slot.applicants.filter(id => !approvedList.includes(id));

                    return (
                        <div key={slot.id} className="bg-white rounded-xl shadow border overflow-hidden break-inside-avoid">
                            <div className={`${labelColor} text-white px-4 py-2 flex justify-between items-center`}>
                                <span className="font-bold text-sm">{label} ({slot.startDate} ~ {slot.endDate})</span>
                                <span className="text-xs bg-white bg-opacity-20 px-2 py-0.5 rounded font-bold">名额: {slot.limit}</span>
                            </div>
                            <div className="grid grid-cols-2 divide-x min-h-[120px]">
                                <div className="p-3 bg-green-50/30">
                                    <h4 className="text-xs font-bold text-green-800 uppercase mb-2 flex justify-between">入选名单 ({approvedList.length})</h4>
                                    {/* GRID LAYOUT: 3 Columns */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {approvedList.map(id => {
                                            const pKey = slot.relatedHolidayId || `m_${slot.dominantMonth}`;
                                            const count = getHistoryCount(id, pKey);
                                            return (
                                                <div key={id} className="flex justify-between items-center p-2 rounded text-sm border bg-white border-green-200 shadow-sm">
                                                    <span className="truncate">{employees.find(e=>e.id===id)?.name} <span className="text-slate-400 text-xs">({count}次)</span></span>
                                                    <button onClick={() => updateSlot(slot.id, { approved: slot.approved.filter(x=>x!==id) })} className="text-red-500 no-print ml-1 flex-shrink-0"><ArrowRight size={14}/></button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="p-3 bg-red-50/30">
                                    <h4 className="text-xs font-bold text-red-800 uppercase mb-2">淘汰名单 ({eliminatedList.length})</h4>
                                    {/* GRID LAYOUT: 3 Columns */}
                                    <div className="grid grid-cols-3 gap-2">
                                        {eliminatedList.map(id => {
                                            const pKey = slot.relatedHolidayId || `m_${slot.dominantMonth}`;
                                            const hist = getHistoryCount(id, pKey);
                                            return (
                                                <div key={id} className="flex justify-between items-center p-2 rounded text-sm border bg-white border-red-100 shadow-sm">
                                                    <div className="flex gap-1 items-center truncate">
                                                        <span className="truncate">{employees.find(e=>e.id===id)?.name} <span className="text-slate-400 text-xs">({hist}次)</span></span>
                                                    </div>
                                                    <button onClick={() => updateSlot(slot.id, { approved: [...slot.approved, id] })} className="text-green-500 no-print ml-1 flex-shrink-0"><ArrowLeft size={14}/></button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    </div>
  );

  return (
    <div className="p-4 h-full flex flex-col relative">
      <PasswordModal isOpen={passwordModalOpen} onClose={() => setPasswordModalOpen(false)} onSuccess={handlePasswordSuccess} />
      <PrintModal isOpen={printModalOpen} onClose={() => setPrintModalOpen(false)} content={printContent} title={printTitle} />

      <div className="flex justify-between items-center mb-4 no-print">
        <h2 className="text-2xl font-bold text-slate-800">员工休假管理</h2>
        <div className="flex bg-white rounded-full p-1 shadow-md border border-slate-200">
             <button onClick={() => setActiveTab('monthly')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${activeTab === 'monthly' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>月假安排</button>
             <button onClick={() => setActiveTab('annual')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-200 ${activeTab === 'annual' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}>年假申报</button>
        </div>
      </div>

      {activeTab === 'monthly' ? (
        <div className="flex-1 overflow-hidden">
            {renderMonthlyTab()}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-3 no-print">
                {annualSubTab !== 'cumulative' ? (
                    <div className="flex items-center gap-3 bg-white p-2 rounded border shadow-sm">
                        <span className="font-bold text-slate-700 text-sm">申报年份:</span>
                        <input 
                            type="number" 
                            className="border rounded p-1 w-20 text-center font-bold text-lg text-blue-600 outline-none" 
                            value={annualYearVal} 
                            onChange={e => setAnnualYearVal(+e.target.value)} 
                        />
                    </div>
                ) : <div></div>}
                <div className="flex gap-2 bg-white p-1 rounded border shadow-sm">
                    {[
                        {id: 'settings', label: '1. 日期定义', icon: <Settings size={16}/>},
                        {id: 'cumulative', label: '2. 累计统计', icon: <BarChart3 size={16}/>},
                        {id: 'history', label: '3. 历史统计', icon: <RefreshCw size={16}/>},
                        {id: 'predeclare', label: '4. 预申报', icon: <Calendar size={16}/>},
                        {id: 'result', label: '5. 结果分配', icon: <Trophy size={16}/>}
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setAnnualSubTab(tab.id as any)}
                            className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm transition-colors ${annualSubTab === tab.id ? 'bg-blue-100 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                        >
                            {tab.icon} {tab.label}
                        </button>
                    ))}
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto pb-6">
                {annualSubTab === 'settings' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
                        {/* Statutory Holidays */}
                        <div className="bg-white rounded-xl shadow p-4 border border-slate-100 flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Briefcase size={20} className="text-red-500"/> 法定节假日设置 (Red)</h3>
                                    <p className="text-xs text-slate-500">春节、国庆等国家法定假日</p>
                                </div>
                                <button onClick={() => { if(window.confirm('确定清空所有法定节假日吗？此操作不可恢复。')) saveAnnual({...annualData!, holidays: []}); }} className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded hover:bg-red-50">清空</button>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3 flex flex-col gap-2">
                                <div className="flex items-center gap-2 w-full">
                                    <div className="w-1/3">
                                        <select 
                                            className="input-std p-1 text-sm w-full" 
                                            value={newStatHoliday.name}
                                            onChange={e => handleStatNameChange(e.target.value)}
                                        >
                                            <option value="">请选择...</option> {/* Added default */}
                                            {STATUTORY_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
                                            <option value="自定义">自定义...</option>
                                        </select>
                                        {newStatHoliday.name === '自定义' && (
                                            <input type="text" className="input-std p-1 text-sm w-full mt-1" placeholder="输入名称" value={newStatHoliday.customName} onChange={e => setNewStatHoliday({...newStatHoliday, customName: e.target.value})} />
                                        )}
                                    </div>
                                    <div className="flex-1 flex items-center gap-2">
                                        <input type="date" className="input-std p-1 text-sm" value={newStatHoliday.startDate} onChange={e => onStatDateChange('startDate', e.target.value)} />
                                        <span className="text-slate-400">至</span>
                                        <input type="date" className="input-std p-1 text-sm" value={newStatHoliday.endDate} onChange={e => onStatDateChange('endDate', e.target.value)} />
                                    </div>
                                    <button onClick={handleAddStatHoliday} className="bg-red-500 text-white px-4 py-1.5 rounded hover:bg-red-600 text-sm font-bold whitespace-nowrap">添加</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2">
                                {annualData?.holidays.map(h => (
                                    <div key={h.id} className="flex items-center gap-2 p-2 border rounded-lg bg-red-50 border-red-100">
                                        <span className="font-bold text-red-800 w-24 text-sm">{h.name}</span>
                                        <span className="text-xs text-slate-600">{h.startDate} 至 {h.endDate}</span>
                                        <div className="flex-1"></div>
                                        <button onClick={() => saveAnnual({...annualData!, holidays: annualData!.holidays.filter(hx => hx.id !== h.id)})} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Normal Holidays */}
                        <div className="bg-white rounded-xl shadow p-4 border border-slate-100 flex flex-col">
                            <div className="flex justify-between items-center mb-3">
                                <div>
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Coffee size={20} className="text-green-500"/> 正常节假日设置 (Green)</h3>
                                    <p className="text-xs text-slate-500">连休假日、调整后的普通休息日</p>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 mb-3">
                                <div className="flex gap-2 items-center">
                                    <input type="date" className="input-std flex-1 p-1 text-sm" value={newNormalHoliday.startDate} onChange={e => onNormalDateChange('startDate', e.target.value)} />
                                    <span className="text-slate-400">至</span>
                                    <input type="date" className="input-std flex-1 p-1 text-sm" value={newNormalHoliday.endDate} onChange={e => onNormalDateChange('endDate', e.target.value)} />
                                    <button onClick={handleAddNormalHoliday} className="bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 text-sm font-bold">添加</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto space-y-2">
                                {(annualData?.normalHolidays || []).map(h => (
                                    <div key={h.id} className="flex items-center gap-2 p-2 border rounded-lg bg-green-50 border-green-100">
                                        <span className="font-bold text-green-800 w-24 text-sm">正常节假日</span>
                                        <span className="text-xs text-slate-600">{h.startDate} 至 {h.endDate}</span>
                                        <div className="flex-1"></div>
                                        <button onClick={() => saveAnnual({...annualData!, normalHolidays: annualData!.normalHolidays.filter(hx => hx.id !== h.id)})} className="text-red-400 hover:text-red-600 p-1"><Trash2 size={16}/></button>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Custom Workdays */}
                            <div className="mt-4 pt-4 border-t">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Briefcase size={20} className="text-blue-500"/> 自定义工作日 (调休)</h3>
                                </div>
                                <div className="flex gap-2 mb-3">
                                    <input type="date" className="input-std flex-1 p-1 text-sm" value={newCustomWorkday} onChange={e => setNewCustomWorkday(e.target.value)} />
                                    <button onClick={handleAddCustomWorkday} className="bg-blue-600 text-white px-4 py-1.5 rounded hover:bg-blue-700 text-sm font-bold">添加工作日</button>
                                </div>
                                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                                    {annualData?.customWorkdays.map(d => (
                                        <div key={d} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-slate-200">
                                            <span>{d}</span>
                                            <button onClick={() => saveAnnual({...annualData!, customWorkdays: annualData!.customWorkdays.filter(dx => dx !== d)})} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {annualSubTab === 'cumulative' && renderCumulativeTab()}
                {annualSubTab === 'history' && renderHistoryTab()}
                {annualSubTab === 'predeclare' && renderPredeclareTab()}
                {annualSubTab === 'result' && renderResultTab()}
            </div>
        </div>
      )}
    </div>
  );
};

export default Leave;