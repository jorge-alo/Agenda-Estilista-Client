export const queryKeys = {

  turnos: {

    all: ["turnos"],

    lista: (
      fecha?: string
    ) => [
        "turnos",
        fecha
      ],

    semana: (
      desde: string,
      hasta: string
    ) => [
        "turnos",
        "semana",
        desde,
        hasta
      ],

  },

  dashboard: {

    all: ["dashboard"],

    resumen: (
      fecha: string
    ) => [
        "dashboard",
        fecha
      ],

    clientes: () => [
      "dashboard",
      "clientes"
    ],

    reporteMensual: () => [
      "dashboard",
      "reporteMensual"
    ],

  },

  servicios: {

    all: [
      "servicios"
    ],

    porEstilista: (
      estilistaId: number
    ) => [
        "servicios-estilista",
        estilistaId
      ],
  },

  disponibilidad: {

    admin: (
      fecha: string,
      estilistaId: number,
      servicioId: number
    ) => [
        "disponibilidad-admin",
        fecha,
        estilistaId,
        servicioId
      ],
  },

  estilistas: {
    all: ["estilistas"],
  },

};