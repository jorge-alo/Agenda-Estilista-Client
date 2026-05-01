import "../styles/bloqueos.css";

import {
  BloqueosForm
} from "./BloqueosForm";

interface Props {
  estilistas: any[];
}

export const BloqueosAdmin = ({
  estilistas
}: Props) => {

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