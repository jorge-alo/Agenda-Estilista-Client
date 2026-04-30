interface Props {
  titulo: string;
  valor: string | number;
}

export const MetricasCard = ({
  titulo,
  valor
}: Props) => {

  return (
    <div className="dashboard-card">

      <div className="dashboard-card-title">
        {titulo}
      </div>

      <div className="dashboard-card-value">
        {valor}
      </div>

    </div>
  );
};