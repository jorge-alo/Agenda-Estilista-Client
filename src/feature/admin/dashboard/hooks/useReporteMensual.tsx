import {
  useEffect,
  useState
} from "react";

import {
  dashboardService
} from "../services/dashboard.service";

import type {
  ReporteMensual
} from "../types/dashboard.types";

export const useReporteMensual =
  () => {

    const [data, setData] =
      useState<ReporteMensual | null>(null);

    const [loading, setLoading] =
      useState(true);

    useEffect(() => {

      dashboardService
        .getReporteMensual()
        .then(setData)
        .finally(() =>
          setLoading(false)
        );

    }, []);

    return {
      data,
      loading
    };
  };