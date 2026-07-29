import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { superAdminService } from "../services/superadmin.service";

export const useLocales = () => {
  return useQuery({
    queryKey: queryKeys.superadmin.all,
    queryFn: superAdminService.getLocales,
  });
};