export const queryKeys = {

  publicLocal: {
    context: (slug: string) => ["public-local", slug] as const,
  },

  petAdminBooking: {
    all: ["pet-admin-booking"] as const,
    mascotas: () => ["pet-admin-booking", "mascotas"] as const,
    searchMascotas: (q: string, limit: number) => ["pet-admin-booking", "search-mascotas", q.trim(), limit] as const,
    searches: () => ["pet-admin-booking", "search-mascotas"] as const,
    mascotaDetail: (mascotaId: number | null) => ["pet-admin-booking", "detail", mascotaId] as const,
    servicios: (mascotaId: number | null) => ["pet-admin-booking", "servicios", mascotaId] as const,
    extras: (mascotaId: number | null) => ["pet-admin-booking", "extras", mascotaId] as const,
    availabilityAll: ["pet-admin-booking", "availability"] as const,
    availability: (mascotaId: number | null, servicioId: number | null, extraIds: readonly number[], fecha: string) =>
      ["pet-admin-booking", "availability", mascotaId, servicioId, [...extraIds].sort((a, b) => a - b), fecha] as const,
    creation: () => ["pet-admin-booking", "create"] as const,
  },

  petManagement: {
    scope: (localId: string) => ["pet-management", localId] as const,
    searches: (localId: string) => ["pet-management", localId, "search"] as const,
    search: (localId: string, term: string, estado: string, limit: number) =>
      ["pet-management", localId, "search", term.trim(), estado, limit] as const,
    detail: (localId: string, mascotaId: number | null) =>
      ["pet-management", localId, "detail", mascotaId] as const,
  },

  petBooking: {
    scope: (slug: string, sessionScope: string) => ["pet-public-booking", slug, sessionScope] as const,
    options: (slug: string, sessionScope: string, mascotaId: number | null) =>
      ["pet-public-booking", slug, sessionScope, "options", mascotaId] as const,
    availability: (slug: string, sessionScope: string, mascotaId: number | null, servicioId: number | null, extraIds: readonly number[], fecha: string) =>
      ["pet-public-booking", slug, sessionScope, "availability", mascotaId, servicioId, [...extraIds].sort((a, b) => a - b), fecha] as const,
    creation: (slug: string, sessionScope: string) => ["pet-public-booking", slug, sessionScope, "create"] as const,
  },

  petServicios: {
    all: (localId: string) => ["pet-servicios", localId] as const,
  },

  petMascotaServicios: {
    all: (localId: string, mascotaId: number | null) => ["pet-mascota-servicios", localId, mascotaId] as const,
  },

  petExtras: {
    all: (localId: string) => ["pet-extras-catalog", localId] as const,
  },

  petHorarios: {
    all: (localId: string) => ["pet-horarios", localId] as const,
  },

  petBloqueos: {
    all: (localId: string) => ["pet-bloqueos", localId] as const,
    range: (localId: string, desde: string, hasta: string) => ["pet-bloqueos", localId, desde, hasta] as const,
  },

  petMascotaExtras: {
    all: (localId: string, mascotaId: number | null) => ["pet-mascota-extras", localId, mascotaId] as const,
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
