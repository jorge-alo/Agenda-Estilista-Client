import type { Estilista } from "../../estilistas/types/estilistas.types";
import "../styles/bloqueos.css";

import {
  BloqueosForm
} from "./BloqueosForm";

interface Props {
  estilistas: Estilista[];
}

export const BloqueosAdmin = ({
  estilistas
}: Props) => {

  throw new Error("test")
  return (

    <div className="bloqueos-container">

      <h2 className="bloqueos-title">
        Bloqueo de horarios
      </h2>

      <BloqueosForm
        estilistas={estilistas}
      />

    </div>
  );
};