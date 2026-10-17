import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "../../../shared/lib/queryKeys";
import { publicLocalService } from "../services/publicLocal.service";

export function usePublicLocalContext(slug: string) {
  return useQuery({
    queryKey: queryKeys.publicLocal.context(slug),
    queryFn: () => publicLocalService.getContext(slug),
    enabled: Boolean(slug),
    retry: false,
  });
}
