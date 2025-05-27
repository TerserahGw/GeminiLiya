const express = require('express');
const axios = require('axios');
const { GoogleGenAI, Modality } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: "AIzaSyCaPISFNtOzYapi2o1QMl_vOjPNtAaYVhU" });

async function getImageBase64(imageUrl) {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary').toString('base64');
}

app.get('/api/gemini', async (req, res) => {
    try {
        const { prompt, imageUrl } = req.query;
        if (!prompt) throw new Error("Parameter prompt diperlukan");

        const contents = [{ text: prompt }];

        if (imageUrl) {
            const base64Image = await getImageBase64(imageUrl);
            contents.push({ 
                inlineData: { 
                    mimeType: "image/png", 
                    data: base64Image 
                } 
            });
        }

        const response = await ai.models.generateContent({
            model: "gemini-2.0-flash-preview-image-generation",
            contents: contents,
            config: { responseModalities: [Modality.TEXT, Modality.IMAGE] }
        });

        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                res.set('Content-Type', 'image/png');
                return res.send(Buffer.from(part.inlineData.data, "base64"));
            }
        }

        throw new Error("Gagal mendapatkan gambar dari API");
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
