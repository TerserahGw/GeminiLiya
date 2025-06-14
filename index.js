const express = require('express');
const axios = require('axios');
const { GoogleGenAI, Type, Modality } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

const ai = new GoogleGenAI({ apiKey: "AIzaSyCaPISFNtOzYapi2o1QMl_vOjPNtAaYVhU" });

const getMediaBase64 = async (url) => {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary').toString('base64');
};

const SUPPORTED_AUDIO_TYPES = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mp3',
  '.aiff': 'audio/aiff',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac'
};

const getAudioMimeType = (url) => {
  const extension = url.substring(url.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_AUDIO_TYPES[extension] || null;
};

app.get('/api/audio', async (req, res) => {
  try {
    const { audioUrl } = req.query;
    if (!audioUrl) throw new Error("Audio URL parameter required");

    const mimeType = getAudioMimeType(audioUrl);
    if (!mimeType) throw new Error("Unsupported audio format");

    const contents = [
      { 
        text: "Please analyze this audio and provide: complete transcript, summary, sentiment analysis, and speaker characteristics."
      },
      {
        inlineData: {
          mimeType,
          data: await getMediaBase64(audioUrl)
        }
      }
    ];

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            summary: { type: Type.STRING },
            sentiment: { 
              type: Type.OBJECT,
              properties: {
                overall: { type: Type.STRING },
                confidence: { type: Type.NUMBER }
              }
            },
            speaker: {
              type: Type.OBJECT,
              properties: {
                pace: { type: Type.STRING },
                clarity: { type: Type.STRING },
                emotion: { type: Type.STRING }
              }
            },
            keyTopics: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          }
        }
      }
    });

    res.json(JSON.parse(response.text));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/gemini', async (req, res) => {
  try {
    const { prompt, imageUrl } = req.query;
    if (!prompt) throw new Error("Prompt parameter required");

    const contents = [{ text: prompt }];
    
    if (imageUrl) {
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: await getMediaBase64(imageUrl)
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
          data: await getMediaBase64(imageUrl)
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
