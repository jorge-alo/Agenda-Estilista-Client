// src/feature/admin/dashboard/hooks/useDashboard.ts
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboard.service';
import { queryKeys } from '../../../../shared/lib/queryKeys';

export const useDashboard = (fecha: string) => {

    return useQuery({

    queryKey:
      queryKeys.dashboard.resumen(
        fecha
      ),

    queryFn: () =>
      dashboardService.getResumenDia(
        fecha
      ),
  });
};