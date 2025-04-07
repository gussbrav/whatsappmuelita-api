import OpenAI from "openai";
import config from "../config/env.js";

const client = new OpenAI({
    apiKey: config.OPENAI_API_KEY,
});

const openAiService = async (message) => {
    try {
        const response = await client.chat.completions.create({
            messages: [{ role: 'system', content: 'Eres un veterinario experto de Doctor Muelita, una cadena de centros odontológicos en Perú. Debes responder de forma concisa y clara, sin extenderte innecesariamente. Si un caso es grave o de emergencia, indica al usuario que acuda inmediatamente a un centro de Doctor Muelita. Responde solo en el idioma en el que te escriban (inglés o español).'}, { role: 'user', content: message }],
            model: 'gpt-4o-mini',
            temperature: 0.5,  // Menos creatividad, respuestas más directas
            max_tokens: 250,  // Limita la longitud de la respuesta
            frequency_penalty: 0.2,  // Evita repeticiones innecesarias
            presence_penalty: 0.1,  // Evita respuestas redundantes
        });
        return response.choices[0].message.content;
    } catch (error) {
        console.error(error);
    }
}

export default openAiService;


