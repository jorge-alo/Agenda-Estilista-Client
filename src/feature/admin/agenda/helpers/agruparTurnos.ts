import type { Turno } from "../types/agenda.types";

export const agruparTurnos = (
  turnos: Turno[]
): Record<string, Turno[]> => {
  return turnos.reduce<Record<string, Turno[]>>((grupo, turno) => {
    const fecha = turno.fecha;

    if (!grupo[fecha]) {
      grupo[fecha] = [];
    }

    grupo[fecha].push(turno);

    return grupo;
  }, {});
};