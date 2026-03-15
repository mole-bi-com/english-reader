import { neon } from '@neondatabase/serverless';

// This script should be run locally after setting the DATABASE_URL environment variable.
// You can get the DATABASE_URL from Vercel dashbord -> Storage -> Settings.

async function init() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        console.error('Error: DATABASE_URL environment variable is not set.');
        process.exit(1);
    }

    const sql = neon(databaseUrl);

    try {
        console.log('Creating tables...');

        // 1. Vocab table
        await sql(`
      CREATE TABLE IF NOT EXISTS vocab (
        id SERIAL PRIMARY KEY,
        word TEXT NOT NULL,
        context_sentence TEXT,
        book_title TEXT,
        ko TEXT,
        pos TEXT,
        phonetic TEXT,
        en_definition TEXT,
        ko_translation TEXT,
        is_starred BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(word, context_sentence)
      );
    `);
        console.log('Table "vocab" created or already exists.');

        // 2. Books table
        await sql(`
      CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT UNIQUE NOT NULL,
        text TEXT NOT NULL,
        last_position INTEGER DEFAULT 0,
        hints JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        console.log('Table "books" created or already exists.');

        // 3. Settings table (simplified to one row for single user)
        await sql(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        theme TEXT DEFAULT 'sepia',
        font_size INTEGER DEFAULT 20,
        line_height REAL DEFAULT 1.9,
        font_family TEXT DEFAULT 'Georgia',
        api_key TEXT DEFAULT '',
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT one_row CHECK (id = 1)
      );
    `);
        console.log('Table "settings" created or already exists.');

        console.log('Database initialization complete!');
    } catch (err) {
        console.error('Error initializing database:', err);
        process.exit(1);
    }
}

init();
