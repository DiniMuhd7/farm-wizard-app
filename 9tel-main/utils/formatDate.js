export const formatDate = (rawDate) => {
  // const formatted = new Intl.DateTimeFormat("en-US", {
  //   year: "numeric",
  //   month: "long",
  //   day: "numeric",
  //   hour: "numeric",
  //   minute: "numeric",
  //   timeZoneName: "short",
  // }).format(date);
  const date = new Date(rawDate);

  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0"); // Months are 0-indexed
  const year = date.getUTCFullYear();

  const formatted = `${day}/${month}/${year}`;

  return formatted;
};
