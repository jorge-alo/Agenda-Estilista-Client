export const getFechaLocal = () => {

  const today = new Date();

  today.setMinutes(
    today.getMinutes() -
    today.getTimezoneOffset()
  );

  return today
    .toISOString()
    .split("T")[0];
};