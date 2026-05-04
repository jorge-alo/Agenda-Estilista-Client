// src/feature/admin/dashboard/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard.service';

export const useDashboard = (fecha: string) => {

  return useQuery({
    queryKey: ['dashboard', fecha],
    queryFn: () =>
      dashboardService.getResumenDia(fecha),

  });
};