declare module "better-sqlite3" {
  export default class Database {
    constructor(filename: string, options?: any);
    prepare(sql: string): any;
    exec(sql: string): void;
    close(): void;
  }
}
