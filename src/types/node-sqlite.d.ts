/**
 * Compatibility declarations for node:sqlite when consumers still resolve
 * @types/node 20. The runtime requirement is Node.js 22.13+.
 * These declarations intentionally cover only the synchronous API used here.
 */
declare module "node:sqlite" {
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSync {
    all(...anonymousParameters: unknown[]): unknown[];
    get(...anonymousParameters: unknown[]): unknown;
    run(...anonymousParameters: unknown[]): StatementResultingChanges;
  }

  export class DatabaseSync {
    constructor(location: string, options?: Record<string, unknown>);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }
}
