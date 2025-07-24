import { open } from '@op-engineering/op-sqlite';
import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import {
  AbstractPowerSyncDatabase,
  column,
  createBaseLogger,
  LogLevel,
  PowerSyncDatabase,
  Schema,
  Table,
} from '@powersync/react-native';
import React from 'react';
import { Platform } from 'react-native';

const localhost = Platform.OS === "android" ? "10.0.2.2" : "localhost";

/**
 * If you want to use a PowerSync Cloud instance, change the
 * PS_POWERSYNC_URL to point to a Cloud instance URL.
 */
const Config = {
    PS_BACKEND_URL: `http://${localhost}:6060`,
    PS_POWERSYNC_URL: `http://${localhost}:8080`,
}

const logger = createBaseLogger();
logger.useDefaults();
logger.setLevel(LogLevel.DEBUG);

export class SelfhostConnector {
  private _clientId: string | null = null;

  async fetchCredentials() {
    const token = await fetch(`${Config.PS_BACKEND_URL}/api/auth/token`)
      .then(response => response.json())
      .then(data => data.token);

    return {
      endpoint: Config.PS_POWERSYNC_URL,
      token,
    };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    console.log('Uploading data for transaction:', transaction);

    if (!transaction) {
      return;
    }

    if (!this._clientId) {
      this._clientId = await database.getClientId();
    }

    try {
      let batch: any[] = [];
      for (let operation of transaction.crud) {
        let payload = {
          op: operation.op,
          table: operation.table,
          id: operation.id,
          data: operation.opData,
        };
        batch.push(payload);
      }

      const response = await fetch(`${Config.PS_BACKEND_URL}/api/data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ batch }),
      });

      if (!response.ok) {
        throw new Error(
          `Received ${
            response.status
          } from /api/data: ${await response.text()}`,
        );
      }

      await transaction
        .complete
        // import.meta.env.VITE_CHECKPOINT_MODE == CheckpointMode.CUSTOM
        //   ? await this.getCheckpoint(this._clientId)
        //   : undefined
        ();
      console.log('Transaction completed successfully');
    } catch (ex: any) {
      console.debug(ex);
      throw ex;
    }
  }
}

const customers = new Table({ name: column.text });
const schema = new Schema({ customers });
export const DB_NAME = 'powersync-test.db';

export class System {
  connector: SelfhostConnector;
  powersync: PowerSyncDatabase;

  constructor() {
    this.connector = new SelfhostConnector();
    this.powersync = new PowerSyncDatabase({
      schema,
      database: new OPSqliteOpenFactory({
        dbFilename: DB_NAME,
      }),
      logger,
    });
  }

  async init() {
    await this.powersync.init();
    await this.powersync.connect(this.connector, {
      /**
       * Optional: clientImplementation: SyncClientImplementation.RUST
       */
    });

    await this.powersync.waitForFirstSync();
  }
}

export const system = new System();
export const SystemContext = React.createContext(system);
export const useSystem = () => React.useContext(SystemContext);

const opSqlite = open({
  name: DB_NAME,
});
export const OpSqliteContext = React.createContext(opSqlite);
export const useOpSqlite = () => React.useContext(OpSqliteContext);
