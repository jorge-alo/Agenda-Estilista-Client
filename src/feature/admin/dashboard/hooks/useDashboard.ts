// src/feature/admin/dashboard/hooks/useDashboard.ts
import { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard.service';
import type { ResumenDia } from '../types/dashboard.types';

export const useDashboard = (fecha: string) => {
  const [data, setData] = useState<ResumenDia | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    dashboardService
      .getResumenDia(fecha)
      .then(setData)
      .catch(() => setError('No se pudo cargar el resumen'))
      .finally(() => setLoading(false));
  }, [fecha]);

  return { data, loading, error };
};