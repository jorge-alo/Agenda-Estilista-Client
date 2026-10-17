import { isBusinessType } from "../../../shared/types/businessType";
import { PublicLocalContextError, type PublicLocalContext } from "../types/publicLocal.types";

const API_URL = import.meta.env.VITE_API_URL;

export const publicLocalService = {
  async getContext(slug: string): Promise<PublicLocalContext> {
    const response = await fetch(`${API_URL}/api/public/local/${encodeURIComponent(slug)}`);
    if (!response.ok) throw new PublicLocalContextError(response.status);

    const data: unknown = await response.json();
    if (!data || typeof data !== "object") throw new PublicLocalContextError(500);
    const context = data as Record<string, unknown>;
    if (typeof context.nombre !== "string" || !isBusinessType(context.businessType)) {
      throw new PublicLocalContextError(500);
    }
    return { nombre: context.nombre, businessType: context.businessType };
  },
};
