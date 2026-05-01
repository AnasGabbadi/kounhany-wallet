'use client';
import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AlertsContext = createContext({
  alerts: [],
  setAlerts: () => {},
  markAllRead: () => {},
  unreadCount: 0,
  financialAlerts: [],
  systemAlerts: [],
});

const STORAGE_KEY = 'kounhany_read_alerts';

const getReadKeys = () => {
  if (typeof window === 'undefined') return new Set();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
};

const saveReadKeys = (keys) => {
  if (typeof window === 'undefined') return;
  try {
    const arr = [...keys].slice(-100);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  } catch {}
};

const alertKey = (alert) => `${alert.type}_${alert.category}_${alert.message}_${alert.client_id || 'none'}`;

export function AlertsProvider({ children }) {
  const [alerts, setAlertsState] = useState([]);
  const [readKeys, setReadKeys] = useState(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReadKeys(getReadKeys());
  }, []);

  const setAlerts = useCallback((newAlerts) => {
    setAlertsState(newAlerts);
  }, []);

  const markAllRead = useCallback(() => {
    setReadKeys((prev) => {
      const updated = new Set(prev);
      alerts.forEach((alert) => updated.add(alertKey(alert)));
      saveReadKeys(updated);
      return updated;
    });
  }, [alerts]);

  const unreadCount = mounted
    ? alerts.filter((alert) => !readKeys.has(alertKey(alert))).length
    : 0;

  const financialAlerts = alerts.filter((a) => a.category === 'financial');
  const systemAlerts = alerts.filter((a) => a.category === 'system');

  return (
    <AlertsContext.Provider value={{
      alerts, setAlerts, markAllRead,
      unreadCount, readKeys, alertKey,
      financialAlerts, systemAlerts,
    }}>
      {children}
    </AlertsContext.Provider>
  );
}

export const useAlerts = () => useContext(AlertsContext);