import type {
  Estilista
} from "../types/estilistas.types";

interface Props {
  estilista: Estilista;
}

export const EstilistaItem =
({
  estilista
}: Props) => {

  const iniciales =
    estilista.nombre
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (

    <li className="est-admin-item">

      <div className="est-admin-item-avatar">
        {iniciales}
      </div>

      {estilista.nombre}

    </li>
  );
};