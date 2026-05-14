import { useQuery }
from "@tanstack/react-query";

import { adminPageService }
from "../services/adminPage.service";

export const useAdminMe =
() => {

  return useQuery({

    queryKey: ["admin-me"],

    queryFn: () =>
      adminPageService.me(),

    retry: false,
  });
};