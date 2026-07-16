import { Controller, type Control, type FieldErrors } from "react-hook-form";
import type { ReservaFormData } from "../schemas/reserva.schema";
import { Horarios } from "./Horarios";
import "../styles/FormCliente.css";
import { HorariosSkeleton } from "./HorariosSkeleton";

interface Props {
  control: Control<ReservaFormData>; // 👈 Agregado
  errors: FieldErrors<ReservaFormData>;
  disponibles: string[];
  loadingDisponibles: boolean;
  reservar: (val: string) => void;
  servicioId: number | null;
  fecha: string;
  onFechaChange: (f: string) => void;
}

export const FormCliente = ({
  control, // 👈 Recibimos el control
  errors,
  disponibles,
  loadingDisponibles,
  reservar,
  servicioId,
  fecha,
  onFechaChange
}: Props) => {

  return (
    <div>
      <div className="rp-step">
        <p className="rp-step-label">Tus datos</p>

        {/* INPUT DE NOMBRE CONTROLADO */}
        <Controller
          name="nombre"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              className="fc-input"
              placeholder="Tu nombre completo"
              onChange={(e) => {
                field.onChange(e); // Mantiene RHF actualizado
                console.log("⌨️ onChange nombre:", e.target.value);
              }}
            />
          )}
        />
        {errors.nombre && <p className="fc-error">{errors.nombre.message}</p>}

        {/* INPUT DE TELÉFONO CONTROLADO */}
        <Controller
          name="telefono"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              className="fc-input"
              placeholder="Tu teléfono"
            />
          )}
        />
        {errors.telefono && <p className="fc-error">{errors.telefono.message}</p>}

        <input
          className="fc-input"
          type="date"
          value={fecha}
          onChange={(e) => onFechaChange(e.target.value)}
        />
      </div>

      {servicioId && (
        <div className="rp-step">
          <p className="rp-step-label">Horario disponible</p>
           {loadingDisponibles ? (
            <HorariosSkeleton />
          ) : (
            <Horarios disponibles={disponibles} onSelect={reservar} />
          )}
        </div>
      )}
    </div>
  );
};