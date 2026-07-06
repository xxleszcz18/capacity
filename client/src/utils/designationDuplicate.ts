/** Komunikat zwracany przez API przy identycznym trójpolu SAP + Alias + Free text. */
export const DESIGNATION_DUPLICATE_ERROR =
  'Detal o takim oznaczeniu już istnieje i nie został utworzony kolejny';

export function isDesignationDuplicateError(message: string | undefined | null): boolean {
  if (!message) return false;
  return (
    message === DESIGNATION_DUPLICATE_ERROR ||
    (message.includes('już istnieje') && message.includes('nie został utworzony'))
  );
}
