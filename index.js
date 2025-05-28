const express = require('express');
const axios = require('axios');
const { GoogleGenAI, Modality } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: "AIzaSyCaPISFNtOzYapi2o1QMl_vOjPNtAaYVhU" });

const getImageBase64 = async (imageUrl) => {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary').toString('base64');
};

app.get('/api/gemini', async (req, res) => {
  try {
    const { prompt, imageUrl } = req.query;
    if (!prompt) throw new Error("Prompt parameter required");

    const contents = [{ text: prompt }];
    
    if (imageUrl) {
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: await getImageBase64(imageUrl)
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] }
    });

    const imagePart = response.candidates[0].content.parts.find(part => part.inlineData);
    if (!imagePart) throw new Error("No image generated");
    
    res.set('Content-Type', 'image/png');
    res.send(Buffer.from(imagePart.inlineData.data, "base64"));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/geminiV2', async (req, res) => {
  try {
    const { prompt, imageUrl } = req.query;
    if (!prompt) throw new Error("Prompt parameter required");

    const contents = [{ text: prompt }];
    
    if (imageUrl) {
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: await getImageBase64(imageUrl)
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] }
    });

    const result = { text: null, imageBase64: null };
    
    response.candidates[0].content.parts.forEach(part => {
      if (part.text) {
        result.text = part.text;
      } else if (part.inlineData) {
        result.imageBase64 = part.inlineData.data;
      }
    });

    if (!result.text && !result.imageBase64) throw new Error("No content generated");
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
