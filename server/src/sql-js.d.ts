/** Luźne typy sql.js — szczegóły ma wrapper `prepare` w connection.ts */
declare module 'sql.js' {
  export class Database {
    constructor(data?: unknown);
    exec(sql: string, params?: unknown): unknown;
    run(sql: string, params?: unknown): unknown;
    prepare(sql: string): any;
    export(): Uint8Array;
    close(): void;
    getRowsModified(): number;
  }

  export default function initSqlJs(config?: unknown): Promise<{ Database: typeof Database }>;
}
