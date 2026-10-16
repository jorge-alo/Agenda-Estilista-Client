import { useQuery }
from "@tanstack/react-query";

import { adminPageService }
from "../services/adminPage.service";
import type { AdminMeResponse } from "../types/adminPage.types";

export const useAdminMe =
() => {

  return useQuery<AdminMeResponse>({

    queryKey: ["admin-me"],

    queryFn: () =>
      adminPageService.me(),

    retry: false,
  });
};
