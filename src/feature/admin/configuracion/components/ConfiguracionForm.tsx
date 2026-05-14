import { useState }
from "react";

import {
  useUpdateConfiguracion
} from "../mutations/useUpdateConfiguracion";

import "../styles/ConfiguracionForm.css";

interface Props {

  inicial: {
    nombre: string;

    telefono: string;

    direccion: string;

    descripcion: string;

    horario_apertura: string;

    horario_cierre: string;
  };
}

export const ConfiguracionForm =
({
  inicial
}: Props) => {

  const [form,
    setForm] =
      useState(inicial);

  const updateMutation =
    useUpdateConfiguracion();

  const handleChange =
    (
      e: React.ChangeEvent<
        HTMLInputElement |
        HTMLTextAreaElement
      >
    ) => {

      setForm({
        ...form,

        [e.target.name]:
          e.target.value
      });
    };

  const handleSubmit =
    async () => {

      await updateMutation
        .mutateAsync(form);
    };

  return (

    <div className="config-form">

      <div className="config-field">

        <label>
          Nombre del local
        </label>

        <input
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
        />

      </div>

      <div className="config-field">

        <label>
          Teléfono
        </label>

        <input
          name="telefono"
          value={form.telefono}
          onChange={handleChange}
        />

      </div>

      <div className="config-field">

        <label>
          Dirección
        </label>

        <input
          name="direccion"
          value={form.direccion}
          onChange={handleChange}
        />

      </div>

      <div className="config-field">

        <label>
          Descripción
        </label>

        <textarea
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          rows={3}
        />

      </div>

      <div className="config-row">

        <div className="config-field">

          <label>
            Apertura
          </label>

          <input
            type="time"
            name="horario_apertura"
            value={form.horario_apertura}
            onChange={handleChange}
          />

        </div>

        <div className="config-field">

          <label>
            Cierre
          </label>

          <input
            type="time"
            name="horario_cierre"
            value={form.horario_cierre}
            onChange={handleChange}
          />

        </div>

      </div>

      <button
        className="config-btn"
        onClick={handleSubmit}

        disabled={
          updateMutation.isPending
        }
      >

        {updateMutation.isPending
          ? "Guardando..."
          : "Guardar cambios"}

      </button>

    </div>
  );
};