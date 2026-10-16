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

  petTurnos: {
    all: ["pet-turnos"] as const,
    fecha: (fecha: string) => ["pet-turnos", "fecha", fecha] as const,
    rango: (desde: string, hasta: string) => ["pet-turnos", "rango", desde, hasta] as const,
  },

  petTurnoDisponibilidad: {
    all: ["pet-turno-disponibilidad"] as const,
    turnoFecha: (turnoId: number, fecha: string) => ["pet-turno-disponibilidad", turnoId, fecha] as const,
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

  horarios: {

  all: ["horarios"],

  porEstilista:
    (estilistaId: number) => [
      "horarios",
      estilistaId,
    ],
},

bloqueos: {

    all: ["bloqueos"],
  },

  configuracion: {

  all: ["configuracion"],

},

whatsapp: {

  estado: (
    localId: string
  ) => ["whatsapp", localId],

},

 // 🆕 nuevo
  clientes: {
    all: ["clientes"],
  },
    superadmin: {
    all: ["superadmin", "locales"],
  },

};
