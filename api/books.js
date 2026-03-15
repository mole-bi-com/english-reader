import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);

    try {
        // Ensure hints column exists for existing deployments
        await sql`ALTER TABLE books ADD COLUMN IF NOT EXISTS hints JSONB DEFAULT '{}'`.catch(() => {})

        if (req.method === 'GET') {
            const books = await sql`SELECT * FROM books ORDER BY created_at DESC`;
            return res.status(200).json(books);
        }

        if (req.method === 'DELETE') {
            const { title } = req.body;
            await sql`DELETE FROM books WHERE title = ${title}`;
            return res.status(200).json({ success: true });
        }

        if (req.method === 'POST') {
            const { title, text } = req.body;
            const result = await sql`
        INSERT INTO books (title, text)
        VALUES (${title}, ${text})
        ON CONFLICT (title) DO UPDATE SET updated_at = NOW()
        RETURNING *
      `;
            return res.status(201).json(result[0]);
        }

        if (req.method === 'PATCH') {
            const { title, lastPosition } = req.body;
            const result = await sql`
        UPDATE books 
        SET last_position = ${lastPosition}, updated_at = NOW()
        WHERE title = ${title}
        RETURNING *
      `;
            return res.status(200).json(result[0]);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Books Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
