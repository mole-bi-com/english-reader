import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);

    try {
        if (req.method === 'GET') {
            const result = await sql`SELECT * FROM settings WHERE id = 1`;
            return res.status(200).json(result[0] || {});
        }

        if (req.method === 'POST' || req.method === 'PATCH') {
            const s = req.body;
            const result = await sql`
        INSERT INTO settings (id, theme, font_size, line_height, font_family, api_key, updated_at)
        VALUES (1, ${s.theme}, ${s.fontSize}, ${s.lineHeight}, ${s.fontFamily}, ${s.apiKey}, NOW())
        ON CONFLICT (id) DO UPDATE SET 
          theme = EXCLUDED.theme,
          font_size = EXCLUDED.font_size,
          line_height = EXCLUDED.line_height,
          font_family = EXCLUDED.font_family,
          api_key = EXCLUDED.api_key,
          updated_at = NOW()
        RETURNING *
      `;
            return res.status(200).json(result[0]);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Settings Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
