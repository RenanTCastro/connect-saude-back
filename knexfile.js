require('dotenv').config();

module.exports = {
  development: {
    client: "pg",
    connection: {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_DATABASE || "connect_saude_db",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "admin"
    },
    migrations: {
      tableName: "knex_migrations",
      directory: `${__dirname}/app/database/migrations`,
    },
    pool: {
      min: 2,
      max: 10
    }
  }
};
