export const queryKeys = {

  publicLocal: {
    context: (slug: string) => ["public-local", slug] as const,
  },

  petBooking: {
    scope: (slug: string, sessionScope: string) => ["pet-public-booking", slug, sessionScope] as const,
    options: (slug: string, sessionScope: string, mascotaId: number | null) =>
      ["pet-public-booking", slug, sessionScope, "options", mascotaId] as const,
    availability: (slug: string, sessionScope: string, mascotaId: number | null, servicioId: number | null, extraIds: readonly number[], fecha: string) =>
      ["pet-public-booking", slug, sessionScope, "availability", mascotaId, servicioId, [...extraIds].sort((a, b) => a - b), fecha] as const,
    creation: (slug: string, sessionScope: string) => ["pet-public-booking", slug, sessionScope, "create"] as const,
  },

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
