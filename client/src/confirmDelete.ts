/**
 * Obowiązkowe potwierdzenie przed usunięciem danych lub inną nieodwracalną zmianą w bazie.
 */
export function confirmDelete(message: string): boolean {
  return window.confirm(message);
}
