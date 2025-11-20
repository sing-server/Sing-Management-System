export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface User {
  username: string;
  passwordHash: string; 
  role: UserRole;
}

export type EmpStatus = 'Active' | 'Transfer' | 'Resigned' | 'Retired'; // 在职, 外调, 离职, 退休

export interface Employee {
  id: string;
  name: string;
  contact: string;
  idCard: string;
  joinDate: string;
  
  // New Status Fields
  status: EmpStatus;
  retireDate: string;      // 退休日期
  resignationDate: string; // 离职日期
  transferDate: string;    // 外调日期

  hasPersonCert: boolean;
  hasPortCert: boolean; // 口岸人证
  hasHKMacauPass: boolean;
  hasSecurityCert: boolean;
  positions: string[];
  weeklyRestDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat
}

export interface Vehicle {
  id: string;
  internalId: string;
  plateNumber: string;
  types: string[]; 
  capacity: number; 
  hasPersonVehicleCert: boolean; 
  hasPortVehicleCert: boolean; 
  status: 'Valid' | 'Invalid'; // 有效 / 无效
}

export interface DocumentItem {
  id: string;
  name: string;
  type: 'PersonCert' | 'PortPersonCert' | 'PersonVehicleCert' | 'PortVehicleCert' | 'HKMacauPass' | 'DriverLicense' | 'SecurityCert';
  expiryDate: string;
  holderName: string; // Employee Name or Plate Number
  status: 'Valid' | 'Invalid'; // 有效 / 无效
}

// --- Leave System Types ---

export interface MonthlyLeave {
  id: string;
  year: number;
  month: number;
  employeeId: string;
  restDays: number[]; // Days marked as "休" (Rest/Statutory)
  annualDays: number[]; // Days marked as "年" (Annual Leave)
  stats: {
    springFestival: number; // 春节休息天数
    statutoryHoliday: number; // 其他法定节假日休息天数
    avgStatutory: string; // 法定节假日休息平均天数 (Manual or Calc)
    annualLeaveQuota: number; // 当年年假总天数
    annualLeaveUsed: number; // 当年年假已休天数
    pastMonthRest: number; // 当年往月假休息总天数
    avgMonthRest: string; // 月假休息平均天数
  }
}

export interface StatutoryHoliday {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface AnnualLeaveSlot {
  id: string;
  startDate: string;
  endDate: string;
  dominantMonth: number; // 1-12, Calculated based on workday count
  relatedHolidayId?: string; // If overlaps with a statutory holiday
  limit: number;
  applicants: string[]; // Employee IDs who applied
  approved: string[]; // Employee IDs who won the slot
  customLimit?: boolean; // NEW: Tracks if the limit was manually set (overriding global)
  remarks?: Record<string, string>; // NEW: Key=EmpID, Value=Remark text
}

export interface AnnualLeaveYear {
  year: number;
  holidays: StatutoryHoliday[]; // Configurable holidays for this year
  normalHolidays: StatutoryHoliday[]; // 正常节假日 (Normal Holidays/Adjusted Weekends)
  customWorkdays: string[]; // List of YYYY-MM-DD strings that are treated as workdays (overriding weekends)
  slots: AnnualLeaveSlot[];
  // History stats: 
  // Keys: 'm_1' to 'm_12' for months
  // Keys: 'h_{holidayId}' for specific holidays
  historyStats: Record<string, Record<string, number>>; // EmployeeID -> { 'm_1': 0, 'h_spring': 2, ... }
}

export const POSITIONS = ['调度员', '库管员', '清分员', '业务员', '护卫员'];
export const VEHICLE_TYPES = ['1吨', '3吨', '5吨', '10吨', '14吨'];
export const DOC_TYPES = [
  { label: '人行人证', value: 'PersonCert' },
  { label: '口岸人证', value: 'PortPersonCert' },
  { label: '人行车证', value: 'PersonVehicleCert' },
  { label: '口岸车证', value: 'PortVehicleCert' },
  { label: '港澳通行证', value: 'HKMacauPass' },
  { label: '驾驶证', value: 'DriverLicense' },
  { label: '保安员证', value: 'SecurityCert' },
];

export const WEEK_DAYS = [
  { val: 1, label: '周一' },
  { val: 2, label: '周二' },
  { val: 3, label: '周三' },
  { val: 4, label: '周四' },
  { val: 5, label: '周五' },
  { val: 6, label: '周六' },
  { val: 0, label: '周日' },
];

// Excel Headers Configuration
export const EXCEL_HEADERS = {
  EMPLOYEE: ['工号', '姓名', '联系方式', '身份证号', '入司时间', '退休时间', '状态', '岗位', '每周休息日(0-6)', '人行人证(是/否)', '口岸人证(是/否)', '港澳通行证(是/否)', '保安员证(是/否)'],
  VEHICLE: ['自编号', '车牌号', '车型', '载重(吨)', '状态(有效/无效)', '人行车证(是/否)', '口岸车证(是/否)'],
  DOCUMENT: ['证件类型', '持有人/车', '证件名称/编号', '状态(有效/无效)', '有效期(YYYY-MM-DD)']
};