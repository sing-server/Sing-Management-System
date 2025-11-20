
import { Employee, Vehicle, DocumentItem, MonthlyLeave, AnnualLeaveYear, User, UserRole } from '../types';

const KEYS = {
  USERS: 'vims_users',
  EMPLOYEES: 'vims_employees',
  VEHICLES: 'vims_vehicles',
  DOCUMENTS: 'vims_documents',
  LEAVE_MONTHLY: 'vims_leave_monthly',
  LEAVE_ANNUAL: 'vims_leave_annual',
  SESSION: 'vims_session',
};

// Generic helper
function get<T>(key: string, defaultVal: T): T {
  const stored = localStorage.getItem(key);
  if (!stored) return defaultVal;
  try {
    return JSON.parse(stored);
  } catch (e) {
    return defaultVal;
  }
}

function set<T>(key: string, val: T): void {
  localStorage.setItem(key, JSON.stringify(val));
}

// --- Data Access Objects ---

export const StorageService = {
  // System
  exportData: () => {
    const data: Record<string, any> = {};
    Object.values(KEYS).forEach(key => {
      data[key] = localStorage.getItem(key);
    });
    return JSON.stringify(data);
  },

  importData: (jsonString: string) => {
    try {
      const data = JSON.parse(jsonString);
      Object.keys(data).forEach(key => {
        if (Object.values(KEYS).includes(key)) {
          localStorage.setItem(key, data[key]);
        }
      });
      return true;
    } catch (e) {
      console.error("Import failed", e);
      return false;
    }
  },

  // Auth
  getUsers: () => get<User[]>(KEYS.USERS, []),
  saveUsers: (users: User[]) => set(KEYS.USERS, users),
  getSession: () => {
    const s = localStorage.getItem(KEYS.SESSION);
    return s ? JSON.parse(s) : null;
  },
  setSession: (user: User | null) => {
    if (user) localStorage.setItem(KEYS.SESSION, JSON.stringify(user));
    else localStorage.removeItem(KEYS.SESSION);
  },

  // Employees
  getEmployees: () => get<Employee[]>(KEYS.EMPLOYEES, []),
  saveEmployees: (data: Employee[]) => set(KEYS.EMPLOYEES, data),

  // Vehicles
  getVehicles: () => get<Vehicle[]>(KEYS.VEHICLES, []),
  saveVehicles: (data: Vehicle[]) => set(KEYS.VEHICLES, data),

  // Documents
  getDocuments: () => get<DocumentItem[]>(KEYS.DOCUMENTS, []),
  saveDocuments: (data: DocumentItem[]) => set(KEYS.DOCUMENTS, data),

  // Leave
  getMonthlyLeave: () => get<MonthlyLeave[]>(KEYS.LEAVE_MONTHLY, []),
  saveMonthlyLeave: (data: MonthlyLeave[]) => set(KEYS.LEAVE_MONTHLY, data),
  getAnnualLeave: () => get<AnnualLeaveYear[]>(KEYS.LEAVE_ANNUAL, []),
  saveAnnualLeave: (data: AnnualLeaveYear[]) => set(KEYS.LEAVE_ANNUAL, data),
};
