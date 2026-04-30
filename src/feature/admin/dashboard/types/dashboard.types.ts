// src/feature/admin/dashboard/types/dashboard.types.ts

export interface ResumenDia {
  fecha: string;
  totalTurnos: number;
  completados: number;
  cancelados: number;
  pendientes: number;
  ingresosEstimados: number;
  ocupacionPorcentaje: number;
  turnosPorHora: { hora: string; reservados: number; disponibles: number }[];
  huecos: { hora: string; hora_fin: string; estilista: string }[];
  porEstilista: { nombre: string; iniciales: string; cantidad: number }[];
  turnos: TurnoResumen[];
}

export interface TurnoResumen {
  id: number;
  hora: string;
  clienteNombre: string;
  servicio: string;
  estilista: string;
  estado: 'activo' | 'completado' | 'cancelado';
  precio: number;
}

export interface ClienteHistorial {
  cliente_nombre: string;
  cliente_telefono: string;
  visitas: number;
  ultima_visita: string;
  ultimo_servicio: string;
}

export interface ReporteMensual {
  ingresos: number;
  turnos: number;
  cancelaciones: number;
  servicioTop: string;
  estilistaTop: string;
}