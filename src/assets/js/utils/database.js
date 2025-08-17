/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { NodeBDD, DataType } = require('node-bdd');
const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

const nodedatabase = new NodeBDD();

class Database {
  async createDatabase(tableName, tableConfig) {
    // 1) Récupère le vrai dossier persistant
    const userData = await ipcRenderer.invoke('path-user-data');
    if (!userData || typeof userData !== 'string') {
      throw new Error('path-user-data handler non disponible (ipcMain.handle manquant).');
    }

    // 2) Force un sous-dossier stable "databases"
    const dbDir = path.join(userData, 'databases');
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch (e) {
      console.error('Erreur création dossier DB:', e);
      throw e;
    }

    // 3) Toujours utiliser une extension SQLite (évite des comportements différents dev/prod)
    return await nodedatabase.intilize({
      databaseName: 'Databases',
      fileType: 'sqlite',               // <= important
      tableName: tableName,
      path: dbDir,                      // <= toujours userData/databases
      tableColumns: tableConfig,
    });
  }

  async getDatabase(tableName) {
    return await this.createDatabase(tableName, {
      json_data: DataType.TEXT.TEXT,
    });
  }

  async createData(tableName, data) {
    const table = await this.getDatabase(tableName);
    let row = await nodedatabase.createData(table, { json_data: JSON.stringify(data) });
    const id = row.id;
    const payload = JSON.parse(row.json_data);
    payload.ID = id;
    return payload;
  }

  async readData(tableName, key = 1) {
    const table = await this.getDatabase(tableName);
    const row = await nodedatabase.getDataById(table, key);
    if (!row) return undefined;
    const id = row.id;
    const payload = JSON.parse(row.json_data);
    payload.ID = id;
    return payload;
  }

  async readAllData(tableName) {
    const table = await this.getDatabase(tableName);
    const rows = await nodedatabase.getAllData(table);
    return rows.map(info => {
      const id = info.id;
      const payload = JSON.parse(info.json_data);
      payload.ID = id;
      return payload;
    });
  }

  async updateData(tableName, data, key = 1) {
    const table = await this.getDatabase(tableName);
    await nodedatabase.updateData(table, { json_data: JSON.stringify(data) }, key);
  }

  async deleteData(tableName, key = 1) {
    const table = await this.getDatabase(tableName);
    await nodedatabase.deleteData(table, key);
  }
}

module.exports = Database; 
