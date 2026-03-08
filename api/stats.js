import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);

    try {
        if (req.method === 'GET') {
            const stats = await sql`SELECT * FROM reading_stats ORDER BY read_date DESC LIMIT 30`;
            return res.status(200).json(stats);
        }

        if (req.method === 'POST') {
            const { wordsToAdd, minutesToAdd } = req.body;
            const result = await sql`
        INSERT INTO reading_stats (read_date, words_read, minutes_spent)
        VALUES (CURRENT_DATE, ${wordsToAdd}, ${minutesToAdd})
        ON CONFLICT (read_date) DO UPDATE SET 
          words_read = reading_stats.words_read + EXCLUDED.words_read,
          minutes_spent = reading_stats.minutes_spent + EXCLUDED.minutes_spent
        RETURNING *
      `;
            return res.status(200).json(result[0]);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Stats Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
