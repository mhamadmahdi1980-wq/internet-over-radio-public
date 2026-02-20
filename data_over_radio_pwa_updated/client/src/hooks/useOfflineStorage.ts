import { useState, useEffect, useCallback } from 'react';

interface RadioData {
  messages: string[];
  receivedData: string[];
  timestamp: string;
  totalBits: number;
}

const STORAGE_KEY = 'receivedRadioData';

export function useOfflineStorage() {
  const [data, setData] = useState<RadioData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setData(parsed);
      } else {
        const initialData: RadioData = {
          messages: [],
          receivedData: [],
          timestamp: new Date().toISOString(),
          totalBits: 0,
        };
        setData(initialData);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveData = useCallback((newData: RadioData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
      setError(null);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to save data';
      setError(errorMsg);
      return false;
    }
  }, []);

  const addMessage = useCallback((message: string) => {
    if (!data) return false;
    const updated = {
      ...data,
      messages: [...data.messages, message],
      timestamp: new Date().toISOString(),
    };
    return saveData(updated);
  }, [data, saveData]);

  const addReceivedData = useCallback((receivedData: string) => {
    if (!data) return false;
    const updated = {
      ...data,
      receivedData: [...data.receivedData, receivedData],
      totalBits: data.totalBits + receivedData.length * 8,
      timestamp: new Date().toISOString(),
    };
    return saveData(updated);
  }, [data, saveData]);

  const clearData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      const initialData: RadioData = {
        messages: [],
        receivedData: [],
        timestamp: new Date().toISOString(),
        totalBits: 0,
      };
      setData(initialData);
      setError(null);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to clear data';
      setError(errorMsg);
      return false;
    }
  }, []);

  const exportData = useCallback(() => {
    if (!data) return null;
    return JSON.stringify(data, null, 2);
  }, [data]);

  const importData = useCallback((jsonData: string) => {
    try {
      const parsed = JSON.parse(jsonData);
      if (parsed.messages && Array.isArray(parsed.messages)) {
        return saveData(parsed);
      }
      setError('Invalid data format');
      return false;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to import data';
      setError(errorMsg);
      return false;
    }
  }, [saveData]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    data,
    isLoading,
    error,
    loadData,
    saveData,
    addMessage,
    addReceivedData,
    clearData,
    exportData,
    importData,
  };
}
