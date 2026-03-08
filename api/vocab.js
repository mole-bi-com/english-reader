import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
    const sql = neon(process.env.DATABASE_URL);

    try {
        if (req.method === 'GET') {
            const vocab = await sql`SELECT * FROM vocab ORDER BY created_at DESC`;
            return res.status(200).json(vocab);
        }

        if (req.method === 'POST') {
            const entry = req.body;
            const result = await sql`
        INSERT INTO vocab (
          word, context_sentence, book_title, ko, pos, phonetic, en_definition, ko_translation
        ) VALUES (
          ${entry.word.toLowerCase()}, ${entry.context_sentence}, ${entry.book_title}, 
          ${entry.ko}, ${entry.pos}, ${entry.phonetic}, ${entry.en_definition}, ${entry.ko_translation}
        )
        ON CONFLICT (word, context_sentence) DO NOTHING
        RETURNING *
      `;
            return res.status(201).json(result[0] || { message: 'Already exists' });
        }

        if (req.method === 'DELETE') {
            const { word, context_sentence } = req.query;
            await sql`
        DELETE FROM vocab 
        WHERE word = ${word.toLowerCase()} AND context_sentence = ${context_sentence}
      `;
            return res.status(200).json({ success: true });
        }

        if (req.method === 'PATCH') {
            const { word, context_sentence, is_starred } = req.body;
            const result = await sql`
        UPDATE vocab 
        SET is_starred = ${is_starred}
        WHERE word = ${word.toLowerCase()} AND context_sentence = ${context_sentence}
        RETURNING *
      `;
            return res.status(200).json(result[0]);
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('API Vocab Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
