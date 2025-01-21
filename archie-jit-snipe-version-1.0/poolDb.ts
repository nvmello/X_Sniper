import Database from "better-sqlite3";
import { PublicKey } from "@solana/web3.js";
import { LiquidityPoolKeysV4 } from "@raydium-io/raydium-sdk";
import path from "path";
import fs from "fs";
import { logger } from "./constants";

export class PoolDatabase {
  private db: Database.Database;
  private static instance: PoolDatabase;
  private readonly dbPath: string;

  private constructor() {
    try {
      // Create database directory if it doesn't exist
      const dbDir = path.resolve(__dirname, "database");
      logger.info(`Creating database directory at: ${dbDir}`);

      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
        logger.info("Database directory created successfully");
      }

      this.dbPath = path.join(dbDir, "pools.db");
      logger.info(`Initializing database at: ${this.dbPath}`);

      this.db = new Database(this.dbPath, { verbose: console.log });
      this.init();

      // Test database connection
      const test = this.db.prepare("SELECT 1").get();
      logger.info(`Database connection test: ${JSON.stringify(test)}`);

      logger.info("Database initialized successfully");
    } catch (error) {
      logger.error(`Failed to initialize database: ${error}`);
      throw error;
    }
  }

  public static getInstance(): PoolDatabase {
    if (!PoolDatabase.instance) {
      PoolDatabase.instance = new PoolDatabase();
    }
    return PoolDatabase.instance;
  }

  private init() {
    try {
      // Enable foreign keys and WAL mode for better performance
      this.db.pragma("journal_mode = WAL");
      this.db.pragma("foreign_keys = ON");

      const createTable = `
        CREATE TABLE IF NOT EXISTS pools (
          base_mint TEXT PRIMARY KEY,
          pool_data TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()),
          updated_at INTEGER DEFAULT (unixepoch())
        )
      `;

      this.db.exec(createTable);

      // Verify table creation
      const tables = this.db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all();
      logger.info(`Tables in database: ${JSON.stringify(tables)}`);

      // Test table by inserting and retrieving a dummy record
      this.db.exec(
        "INSERT OR REPLACE INTO pools (base_mint, pool_data) VALUES ('test', '{}')"
      );
      const testRow = this.db
        .prepare("SELECT * FROM pools WHERE base_mint = 'test'")
        .get();
      logger.info(
        `Test row inserted and retrieved: ${JSON.stringify(testRow)}`
      );
      this.db.exec("DELETE FROM pools WHERE base_mint = 'test'");
    } catch (error) {
      logger.error(`Failed to initialize tables: ${error}`);
      throw error;
    }
  }

  addPool(poolKeys: LiquidityPoolKeysV4): boolean {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO pools (base_mint, pool_data, updated_at)
      VALUES (?, ?, unixepoch())
    `);

    try {
      const serializedPool = this.serializePoolKeys(poolKeys);
      const baseMint = poolKeys.baseMint.toString();

      stmt.run(baseMint, JSON.stringify(serializedPool));
      logger.info(`Successfully added/updated pool for base mint: ${baseMint}`);

      // Verify the insert
      const inserted = this.getPoolByBaseMint(baseMint);
      if (!inserted) {
        throw new Error("Pool was not properly inserted");
      }

      return true;
    } catch (error) {
      logger.error(`Error adding pool: ${error}`);
      return false;
    }
  }

  getPoolByBaseMint(baseMint: string | PublicKey): LiquidityPoolKeysV4 | null {
    const baseMintString =
      baseMint instanceof PublicKey ? baseMint.toString() : baseMint;

    const stmt = this.db.prepare(
      "SELECT pool_data FROM pools WHERE base_mint = ?"
    );
    try {
      const row = stmt.get(baseMintString) as { pool_data: string } | undefined;
      if (!row) {
        logger.info(`No pool found for base mint: ${baseMintString}`);
        return null;
      }

      const parsedData = JSON.parse(row.pool_data);
      return {
        id: new PublicKey(parsedData.id),
        baseMint: new PublicKey(parsedData.baseMint),
        quoteMint: new PublicKey(parsedData.quoteMint),
        lpMint: new PublicKey(parsedData.lpMint),
        baseDecimals: parsedData.baseDecimals,
        quoteDecimals: parsedData.quoteDecimals,
        lpDecimals: parsedData.lpDecimals,
        version: parsedData.version,
        programId: new PublicKey(parsedData.programId),
        authority: new PublicKey(parsedData.authority),
        openOrders: new PublicKey(parsedData.openOrders),
        targetOrders: new PublicKey(parsedData.targetOrders),
        baseVault: new PublicKey(parsedData.baseVault),
        quoteVault: new PublicKey(parsedData.quoteVault),
        withdrawQueue: new PublicKey(parsedData.withdrawQueue),
        lpVault: new PublicKey(parsedData.lpVault),
        marketVersion: parsedData.marketVersion,
        marketProgramId: new PublicKey(parsedData.marketProgramId),
        marketId: new PublicKey(parsedData.marketId),
        marketAuthority: new PublicKey(parsedData.marketAuthority),
        marketBaseVault: new PublicKey(parsedData.marketBaseVault),
        marketQuoteVault: new PublicKey(parsedData.marketQuoteVault),
        marketBids: new PublicKey(parsedData.marketBids),
        marketAsks: new PublicKey(parsedData.marketAsks),
        marketEventQueue: new PublicKey(parsedData.marketEventQueue),
        lookupTableAccount: new PublicKey(parsedData.lookupTableAccount),
      } as LiquidityPoolKeysV4;
    } catch (error) {
      logger.error(`Error getting pool: ${error}`);
      return null;
    }
  }

  getAllPools(): LiquidityPoolKeysV4[] {
    try {
      const stmt = this.db.prepare("SELECT pool_data FROM pools");
      const rows = stmt.all() as { pool_data: string }[];
      return rows.map((row) => {
        const parsedData = JSON.parse(row.pool_data);
        return {
          id: new PublicKey(parsedData.id),
          baseMint: new PublicKey(parsedData.baseMint),
          quoteMint: new PublicKey(parsedData.quoteMint),
          lpMint: new PublicKey(parsedData.lpMint),
          baseDecimals: parsedData.baseDecimals,
          quoteDecimals: parsedData.quoteDecimals,
          lpDecimals: parsedData.lpDecimals,
          version: parsedData.version,
          programId: new PublicKey(parsedData.programId),
          authority: new PublicKey(parsedData.authority),
          openOrders: new PublicKey(parsedData.openOrders),
          targetOrders: new PublicKey(parsedData.targetOrders),
          baseVault: new PublicKey(parsedData.baseVault),
          quoteVault: new PublicKey(parsedData.quoteVault),
          withdrawQueue: new PublicKey(parsedData.withdrawQueue),
          lpVault: new PublicKey(parsedData.lpVault),
          marketVersion: parsedData.marketVersion,
          marketProgramId: new PublicKey(parsedData.marketProgramId),
          marketId: new PublicKey(parsedData.marketId),
          marketAuthority: new PublicKey(parsedData.marketAuthority),
          marketBaseVault: new PublicKey(parsedData.marketBaseVault),
          marketQuoteVault: new PublicKey(parsedData.marketQuoteVault),
          marketBids: new PublicKey(parsedData.marketBids),
          marketAsks: new PublicKey(parsedData.marketAsks),
          marketEventQueue: new PublicKey(parsedData.marketEventQueue),
          lookupTableAccount: new PublicKey(parsedData.lookupTableAccount),
        } as LiquidityPoolKeysV4;
      });
    } catch (error) {
      logger.error(`Error getting all pools: ${error}`);
      return [];
    }
  }

  private serializePoolKeys(poolKeys: LiquidityPoolKeysV4) {
    return {
      id: poolKeys.id.toString(),
      baseMint: poolKeys.baseMint.toString(),
      quoteMint: poolKeys.quoteMint.toString(),
      lpMint: poolKeys.lpMint.toString(),
      baseDecimals: poolKeys.baseDecimals,
      quoteDecimals: poolKeys.quoteDecimals,
      lpDecimals: poolKeys.lpDecimals,
      version: poolKeys.version,
      programId: poolKeys.programId,
      authority: poolKeys.authority.toString(),
      openOrders: poolKeys.openOrders.toString(),
      targetOrders: poolKeys.targetOrders.toString(),
      baseVault: poolKeys.baseVault.toString(),
      quoteVault: poolKeys.quoteVault.toString(),
      withdrawQueue: poolKeys.withdrawQueue.toString(),
      lpVault: poolKeys.lpVault.toString(),
      marketVersion: poolKeys.marketVersion,
      marketProgramId: poolKeys.marketProgramId,
      marketId: poolKeys.marketId,
      marketAuthority: poolKeys.marketAuthority.toString(),
      marketBaseVault: poolKeys.marketBaseVault.toString(),
      marketQuoteVault: poolKeys.marketQuoteVault.toString(),
      marketBids: poolKeys.marketBids.toString(),
      marketAsks: poolKeys.marketAsks.toString(),
      marketEventQueue: poolKeys.marketEventQueue.toString(),
      lookupTableAccount: poolKeys.lookupTableAccount.toString(),
    };
  }

  close() {
    if (this.db) {
      this.db.close();
    }
  }
}
