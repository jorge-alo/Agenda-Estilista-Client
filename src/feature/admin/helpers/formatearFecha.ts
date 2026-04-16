

export const formatearFecha = (fechaISO: string) => {
  const [year, month, day] = fechaISO.split("T")[0].split("-").map(Number);
    const fecha = new Date(year, month - 1, day);

    return fecha.toLocaleDateString("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric"
    });
}
