/**
 * Generic PostgreSQL Database Connection
 * 
 * This module provides a database connection pool and Drizzle ORM instance
 * that works with any PostgreSQL database (local, AWS RDS, Google Cloud SQL, etc.)
 * 
 * Environment Variables:
 * - DATABASE_URL: PostgreSQL connection string
 * - DB_POOL_SIZE: Maximum number of connections in pool (default: 20)
 * - DB_IDLE_TIMEOUT: Connection idle timeout in ms (default: 30000)
 */
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from '@shared/schema';

// Validate required environment variables
if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL must be set. Did you forget to provision a database?',
  );
}

// Database connection configuration
const connectionConfig = {
  connectionString: process.env.DATABASE_URL,
  // Connection pool settings for optimal performance
  max: parseInt(process.env.DB_POOL_SIZE || '20', 10), // Maximum number of connections
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10), // 30 seconds
  connectionTimeoutMillis: 5000, // 5 seconds connection timeout
  // SSL configuration - automatically handled by connection string or environment
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
};

/**
 * PostgreSQL connection pool
 * Handles connection lifecycle and provides efficient connection reuse
 */
export const pool = new Pool(connectionConfig);

/**
 * Drizzle ORM database instance
 * Provides type-safe database operations with full schema support
 */
export const db = drizzle(pool, { schema });

/**
 * Health check function for database connectivity
 * @returns Promise<boolean> - true if database is accessible
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}

/**
 * Graceful shutdown handler for database connections
 * Should be called when the application is shutting down
 */
export async function closeDatabaseConnections(): Promise<void> {
  try {
    await pool.end();
    console.log('Database connections closed successfully');
  } catch (error) {
    console.error('Error closing database connections:', error);
  }
}