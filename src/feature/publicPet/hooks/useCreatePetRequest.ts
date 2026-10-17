import { useMutation } from "@tanstack/react-query";
import { publicPetService } from "../services/publicPet.service";
import type { PetFirstVisitData } from "../schemas/petFirstVisit.schema";

export function useCreatePetRequest(slug: string) {
  return useMutation<void, Error, PetFirstVisitData>({
    mutationFn: values => publicPetService.createRequest(slug, values),
  });
}
