import pg from 'pg';
const { Pool } = pg;

// Use the DATABASE_URL provided by Heroku in production
// Fallback to local configuration for development
const connectionConfig = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        // CRITICAL: Required for secure SSL connection with Heroku Postgres
        ssl: {
            rejectUnauthorized: false
        }
    }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'academy',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
    };

const pool = new Pool(connectionConfig);

// Test database connection
pool.on('connect', () => {
    console.log('Database connected successfully');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

export default pool;