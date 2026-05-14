import { useState }
from "react";

import type {
  AdminTab
} from "../types/adminPage.types";

export const useAdminTabs =
() => {

  const [tabActiva,
    setTabActiva] =
      useState<AdminTab>(
        "agenda"
      );

  return {
    tabActiva,
    setTabActiva,
  };
};