export function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : timestamp;

  if (!date) {
    return "Baru saja";
  }

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
