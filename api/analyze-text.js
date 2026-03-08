const { GoogleGenerativeAI } = require("@google generative-ai");
const { neon } = require('@neondatabase/serverless');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { text, bookTitle } = req.body;
    const sql = neon(process.env.DATABASE_URL);

    try {
        // 1. Get API Key from settings table
        const settings = await sql`SELECT api_key FROM settings WHERE id = 1`;
        const apiKey = settings[0]?.api_key;

        if (!apiKey) {
            return res.status(400).json({ error: 'Gemini API Key not found in settings' });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
      Analyze the following English text. Identify approximately 10-20 words that would be difficult for an intermediate English learner (B1-B2 level).
      For each word, provide its short Korean meaning (1-3 words).
      Return ONLY a JSON object where the key is the English word (lowercase) and the value is the Korean meaning.
      
      Example: {"sophisticated": "정교한", "unprecedented": "전례 없는"}
      
      Text to analyze:
      ${text.substring(0, 5000)}
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let jsonText = response.text();

        // Clean up markdown if present
        jsonText = jsonText.replace(/```json|```/g, '').trim();
        const hints = JSON.parse(jsonText);

        // 2. Save hints to books table if bookTitle is provided
        if (bookTitle) {
            await sql`
        UPDATE books 
        SET hints = ${JSON.stringify(hints)}
        WHERE title = ${bookTitle}
      `;
        }

        return res.status(200).json(hints);
    } catch (error) {
        console.error('AI Analysis Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
