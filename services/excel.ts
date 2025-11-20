import * as XLSX from 'xlsx';
import { EXCEL_HEADERS, DOC_TYPES, StatutoryHoliday, Employee, AnnualLeaveYear } from '../types';

export const ExcelService = {
  // Generic Export
  exportToExcel: (data: any[], headers: string[], filename: string) => {
    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: 'A1' });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  },

  // Specialized: Export Monthly Leave Table with Dynamic Headers
  exportMonthlyTable: (
    year: number, 
    month: number, 
    employees: Employee[], 
    monthlyData: any[], 
    daysInMonth: number, 
    holidays: StatutoryHoliday[]
  ) => {
    const headers = [
        '工号', '姓名', '休假习惯',
        ...Array.from({length: daysInMonth}, (_, i) => `${i+1}日`),
        ...holidays.map(h => h.name), // Dynamic Holiday Columns
        '年假总额', '年假已休', '往月休', '月均休'
    ];

    const data = employees.map(emp => {
        const record = monthlyData.find(r => r.employeeId === emp.id && r.year === year && r.month === month);
        const restDays = record?.restDays || [];
        
        // Build row
        const row: any = {
            '工号': emp.id,
            '姓名': emp.name,
            '休假习惯': (emp.weeklyRestDays || []).join(','),
        };

        // Days
        for(let i=1; i<=daysInMonth; i++) {
            row[`${i}日`] = restDays.includes(i) ? '休' : '';
        }

        // Holidays stats (Pre-calculated passed in or calc here? doing simple lookup)
        // Note: To keep this pure, we assume the caller might pass raw data. 
        // But for simplicity, we re-implement simple intersection logic or rely on passed stats if they were granular.
        // Since specific holiday stats are dynamic, we'll calculate them here for export accuracy.
        holidays.forEach(h => {
            // Calculate intersection for this specific month/emp
            let count = 0;
            const hStart = new Date(h.startDate);
            const hEnd = new Date(h.endDate);
            
            restDays.forEach(d => {
                const current = new Date(year, month - 1, d);
                // Reset time for accurate comparison
                const cTime = current.getTime();
                const sTime = hStart.setHours(0,0,0,0);
                const eTime = hEnd.setHours(0,0,0,0);
                if (cTime >= sTime && cTime <= eTime) {
                    count++;
                }
            });
            row[h.name] = count;
        });

        row['年假总额'] = record?.stats.annualLeaveQuota || 0;
        row['年假已休'] = record?.stats.annualLeaveUsed || 0;
        row['往月休'] = record?.stats.pastMonthRest || 0;
        row['月均休'] = record?.stats.avgMonthRest || 0;

        return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'MonthlyLeave');
    XLSX.writeFile(workbook, `月假统计_${year}_${month}.xlsx`);
  },

  // Specialized: Export Annual History Stats
  exportHistoryStats: (employees: Employee[], annualData: AnnualLeaveYear) => {
      const holidays = annualData.holidays;
      // Headers: ID, Name, Month 1-12, Holiday Names
      const headers = [
          '工号', '姓名',
          ...Array.from({length: 12}, (_, i) => `${i+1}月`),
          ...holidays.map(h => h.name)
      ];

      const data = employees.map(emp => {
          const stats = annualData.historyStats?.[emp.id] || {};
          const row: any = { '工号': emp.id, '姓名': emp.name };
          
          // Months
          for(let i=1; i<=12; i++) {
              row[`${i}月`] = stats[`m_${i}`] || 0;
          }
          // Holidays
          holidays.forEach(h => {
              row[h.name] = stats[h.id] || 0;
          });
          return row;
      });

      const worksheet = XLSX.utils.json_to_sheet(data, { header: headers });
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'HistoryStats');
      XLSX.writeFile(workbook, `年假历史统计_${annualData.year}.xlsx`);
  },

  // Download Template
  downloadTemplate: (type: 'EMPLOYEE' | 'VEHICLE' | 'DOCUMENT' | 'HISTORY_STATS') => {
    if (type === 'HISTORY_STATS') {
        // Generic template for history
        const headers = ['工号', '姓名', '1月', '2月', '...', '12月', '春节', '国庆节', '(填入对应次数)'];
        const worksheet = XLSX.utils.aoa_to_sheet([headers]);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
        XLSX.writeFile(workbook, `历史统计导入模板.xlsx`);
        return;
    }

    const headers = EXCEL_HEADERS[type];
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, `${type}_Template.xlsx`);
  },

  // Parse Excel
  readExcel: async (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          resolve(json);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsBinaryString(file);
    });
  },

  // Parse History Excel specifically
  readHistoryExcel: async (file: File): Promise<{header: string[], rows: any[]}> => {
      const raw = await ExcelService.readExcel(file);
      if (raw.length < 2) throw new Error("Empty file");
      const header = raw[0].map((h: any) => String(h).trim());
      const rows = raw.slice(1);
      return { header, rows };
  },

  // Mappers
  mapEmployeeImport: (row: any[]): any => {
    // Map row array to Employee Object based on EXCEL_HEADERS.EMPLOYEE index
    // Simple validation logic should be in the component
    return {
      id: row[0] ? String(row[0]) : '',
      name: row[1] || '',
      contact: row[2] || '',
      idCard: row[3] || '',
      joinDate: row[4] || '', // Date parsing might be needed if Excel stores as number
      retireDate: row[5] || '',
      positions: row[6] ? String(row[6]).split(',') : [],
      weeklyRestDays: row[7] ? String(row[7]).split(',').map(Number) : [],
      hasPersonCert: row[8] === '是',
      hasPortCert: row[9] === '是',
      hasHKMacauPass: row[10] === '是',
      hasSecurityCert: row[11] === '是',
    };
  },

  mapVehicleImport: (row: any[]): any => {
    return {
        id: Date.now().toString() + Math.random().toString().substr(2,5),
        internalId: row[0] ? String(row[0]) : '',
        plateNumber: row[1] || '',
        types: row[2] ? String(row[2]).split(',') : [],
        capacity: Number(row[3]) || 0,
        hasPersonVehicleCert: row[4] === '是',
        hasPortVehicleCert: row[5] === '是',
    };
  },

  mapDocumentImport: (row: any[]): any => {
      // Reverse lookup type label
      const typeLabel = row[0];
      const typeObj = DOC_TYPES.find(d => d.label === typeLabel);
      return {
          id: Date.now().toString() + Math.random().toString().substr(2,5),
          type: typeObj ? typeObj.value : 'PersonCert',
          holderName: row[1] || '',
          name: row[2] || '',
          expiryDate: row[3] || '', // Needs standard YYYY-MM-DD
      };
  }
};