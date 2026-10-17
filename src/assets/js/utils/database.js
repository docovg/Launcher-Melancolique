/**
 * @author Luuxis
 * @license CC-BY-NC 4.0 - https://creativecommons.org/licenses/by-nc/4.0
 */

const { NodeBDD, DataType } = require('node-bdd');
const nodedatabase = new NodeBDD()
const { ipcRenderer } = require('electron')

let dev = process.env.NODE_ENV === 'dev';

class database {
    async creatDatabase(tableName, tableConfig) {
        const databasePath = dev
            ? `${await ipcRenderer.invoke('path-user-data')}../..`
            : await ipcRenderer.invoke('launcher-database-path')

        return await nodedatabase.intilize({
            databaseName: 'Databases',
            fileType: dev ? 'sqlite' : 'db',
            tableName: tableName,
            path: databasePath,
            tableColumns: tableConfig,
        });
    }

    async getDatabase(tableName) {
        return await this.creatDatabase(tableName, {
            json_data: DataType.TEXT.TEXT,
        });
    }

    async closeDatabase(database) {
        if (!database?.table) return;

        await new Promise((resolve, reject) => {
            database.table.close(error => error ? reject(error) : resolve())
        })
    }

    async createData(tableName, data) {
        let table = await this.getDatabase(tableName);
        try {
            data = await nodedatabase.createData(table, { json_data: JSON.stringify(data) })
            let id = data.id
            data = JSON.parse(data.json_data)
            data.ID = id
            return data
        } finally {
            await this.closeDatabase(table)
        }
    }

    async readData(tableName, key = 1) {
        let table = await this.getDatabase(tableName);
        try {
            let data = await nodedatabase.getDataById(table, key)
            if (data) {
                let id = data.id
                data = JSON.parse(data.json_data)
                data.ID = id
            }
            return data ? data : undefined
        } finally {
            await this.closeDatabase(table)
        }
    }

    async readAllData(tableName) {
        let table = await this.getDatabase(tableName);
        try {
            let data = await nodedatabase.getAllData(table)
            return data.map(info => {
                let id = info.id
                info = JSON.parse(info.json_data)
                info.ID = id
                return info
            })
        } finally {
            await this.closeDatabase(table)
        }
    }

    async updateData(tableName, data, key = 1) {
        if (!/^[A-Za-z0-9_]+$/.test(tableName)) throw new Error('Invalid database table name');

        const database = await this.getDatabase(tableName);
        try {
            return await new Promise((resolve, reject) => {
                database.table.run(
                    `UPDATE ${tableName} SET json_data = ?, updatedAt = ? WHERE id = ?`,
                    [JSON.stringify(data), new Date(), key],
                    error => error ? reject(error) : resolve()
                );
            });
        } finally {
            await this.closeDatabase(database)
        }
    }

    async deleteData(tableName, key = 1) {
        let table = await this.getDatabase(tableName);
        try {
            await nodedatabase.deleteData(table, key)
        } finally {
            await this.closeDatabase(table)
        }
    }
}

export default database;
