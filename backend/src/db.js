const { Pool } = require('pg');

class Database {
  constructor(config) {
    this.pool = new Pool(config);
    this.counter = 0;
  }

  get pool() {
    return this._pool;
  }

  set pool(value) {
    this._pool = value;
  }

  prepare(sql) {
    const self = this;
    return {
      get: async (...params) => {
        const convertedSql = self.convertParams(sql, params);
        const result = await self.pool.query(convertedSql.sql, convertedSql.params);
        return result.rows[0];
      },
      all: async (...params) => {
        const convertedSql = self.convertParams(sql, params);
        const result = await self.pool.query(convertedSql.sql, convertedSql.params);
        return result.rows;
      },
      run: async (...params) => {
        const convertedSql = self.convertParams(sql, params);
        
        if (sql.trim().toUpperCase().startsWith('INSERT')) {
          const result = await self.pool.query(convertedSql.sql + ' RETURNING id', convertedSql.params);
          return { lastInsertRowid: result.rows[0]?.id, rowCount: result.rowCount, changes: result.rowCount };
        }
        
        const result = await self.pool.query(convertedSql.sql, convertedSql.params);
        return { lastInsertRowid: null, rowCount: result.rowCount, changes: result.rowCount };
      }
    };
  }

  convertParams(sql, params) {
    let paramIndex = 1;
    let newSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    return { sql: newSql, params };
  }

  async query(text, params) {
    return this.pool.query(text, params);
  }

  async release() {
    await this.pool.end();
  }
}

module.exports = Database;
