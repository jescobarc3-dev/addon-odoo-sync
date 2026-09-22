import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  schema: 'integracion_sap',
  entities: ['dist/**/*.orm-entity.js'],
  migrations: ['dist/migrations/*.js'],
});
