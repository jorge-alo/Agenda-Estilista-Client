import { useState }
from "react";
import { useCrearBloqueo } from "../mutations/useCrearBloqueos";

interface Props {
  estilistas: any[];
}

export const BloqueosForm =
({
  estilistas
}: Props) => {

  const crearMutation =
    useCrearBloqueo();

  const [estilistaId,
    setEstilistaId] =
      useState("");

  const [fecha,
    setFecha] =
      useState("");

  const [horaInicio,
    setHoraInicio] =
      useState("");

  const [horaFin,
    setHoraFin] =
      useState("");

  const [motivo,
    setMotivo] =
      useState("");

  const [diaCompleto,
    setDiaCompleto] =
      useState(false);

  const handleSubmit =
    async () => {

      if (
        !estilistaId ||
        !fecha
      ) {
        return;
      }

      if (
        !diaCompleto &&
        (
          !horaInicio ||
          !horaFin
        )
      ) {
        return;
      }

      await crearMutation.mutateAsync({

        estilista_id:
          Number(estilistaId),

        fecha,

        hora_inicio:
          diaCompleto
            ? "00:00"
            : horaInicio,

        hora_fin:
          diaCompleto
            ? "23:59"
            : horaFin,

        motivo,
      });

      setFecha("");
      setHoraInicio("");
      setHoraFin("");
      setMotivo("");
      setDiaCompleto(false);
    };

  return (

    <div className="bloqueos-form">

      <select
        value={estilistaId}
        onChange={(e) =>
          setEstilistaId(
            e.target.value
          )
        }
      >

        <option value="">
          Seleccionar estilista
        </option>

        {estilistas.map((e: any) => (

          <option
            key={e.id}
            value={e.id}
          >
            {e.nombre}
          </option>

        ))}

      </select>

      <input
        type="date"
        value={fecha}
        onChange={(e) =>
          setFecha(
            e.target.value
          )
        }
      />

      <label>

        <input
          type="checkbox"
          checked={diaCompleto}
          onChange={(e) =>
            setDiaCompleto(
              e.target.checked
            )
          }
        />

        Bloquear día completo

      </label>

      {!diaCompleto && (
        <>

          <input
            type="time"
            value={horaInicio}
            onChange={(e) =>
              setHoraInicio(
                e.target.value
              )
            }
          />

          <input
            type="time"
            value={horaFin}
            onChange={(e) =>
              setHoraFin(
                e.target.value
              )
            }
          />

        </>
      )}

      <input
        type="text"
        placeholder="Motivo"
        value={motivo}
        onChange={(e) =>
          setMotivo(
            e.target.value
          )
        }
      />

      <button
        onClick={handleSubmit}
        disabled={
          crearMutation.isPending
        }
      >

        {crearMutation.isPending
          ? "Guardando..."
          : "Guardar bloqueo"}

      </button>

    </div>
  );
};