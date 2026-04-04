const pool = require('./src/db/pool');

async function migrate() {
    try {
        console.log('Starting migration...');
        await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0;');
        await pool.query('ALTER TABLE videos ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP NULL;');
        console.log('Migration successful: progress and failed_at columns added.');
    } catch (err) {
        console.error('Migration failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
