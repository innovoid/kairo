import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ExportedData {
  user: any;
  hosts: any[];
  keys: any[];
  settings: any;
}

export interface UseDataExportReturn {
  exportData: () => Promise<ExportedData>;
  downloadData: () => Promise<void>;
  isExporting: boolean;
}

export function useDataExport(): UseDataExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = async (): Promise<ExportedData> => {
    setIsExporting(true);
    try {
      // Fetch user data
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error('Failed to fetch user data');
      }

      // Fetch user ID for subsequent queries
      const userId = authData.user.id;

      // Fetch hosts, keys, and settings
      const [hostsResult, keysResult, settingsResult] = await Promise.all([
        supabase.from('hosts').select('*').eq('user_id', userId),
        supabase.from('keys').select('*').eq('user_id', userId),
        supabase.from('settings').select('*').eq('user_id', userId),
      ]);

      if (hostsResult.error) throw hostsResult.error;
      if (keysResult.error) throw keysResult.error;
      if (settingsResult.error) throw settingsResult.error;

      const exportedData: ExportedData = {
        user: authData.user,
        hosts: hostsResult.data || [],
        keys: keysResult.data || [],
        settings: settingsResult.data?.[0] || null,
      };

      return exportedData;
    } finally {
      setIsExporting(false);
    }
  };

  const downloadData = async (): Promise<void> => {
    try {
      const data = await exportData();
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      // Create and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = `export-${new Date().toISOString().split('T')[0]}.json`;
      link.click();

      // Cleanup
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportData,
    downloadData,
    isExporting,
  };
}
