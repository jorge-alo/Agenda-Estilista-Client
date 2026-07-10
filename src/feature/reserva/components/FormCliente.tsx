import type {
  FieldErrors,
  UseFormRegister
} from "react-hook-form";

import type {
  ReservaFormData
} from "../schemas/reserva.schema";

import { Horarios } from "./Horarios";

import "../styles/FormCliente.css";

interface Props {

  register:
  UseFormRegister<ReservaFormData>;
  errors:
  FieldErrors<ReservaFormData>;
  disponibles: string[];
  reservar: (val: string) => void;
  servicioId: number | null;
  fecha: string;
  onFechaChange: (f: string) => void;
}

export const FormCliente = ({
  register,
  errors,
  disponibles,
  reservar,
  servicioId,
  fecha,
  onFechaChange
}: Props) => {

  return (
    <div>

      <div className="rp-step">

        <p className="rp-step-label">
          Tus datos
        </p>

        <input
          className="fc-input"
          placeholder="Tu nombre completo"

          {...register("nombre", {
            onChange: (e) => console.log("⌨️ onChange nombre:", e.target.value),
          })}
        />

        {errors.nombre && (
          <p className="fc-error">
            {errors.nombre.message}
          </p>
        )}

        <input
          className="fc-input"
          placeholder="Tu teléfono"

          {...register("telefono")}
        />

        {errors.telefono && (
          <p className="fc-error">
            {errors.telefono.message}
          </p>
        )}

        <input
          className="fc-input"
          type="date"
          value={fecha}
          onChange={(e) => onFechaChange(e.target.value)}
        />
      </div>

      {servicioId && (

        <div className="rp-step">

          <p className="rp-step-label">
            Horario disponible
          </p>

          <Horarios
            disponibles={disponibles}
            onSelect={reservar}
          />
        </div>
      )}
    </div>
  );
};