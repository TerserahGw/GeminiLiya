const express = require('express');
const axios = require('axios');
const { GoogleGenAI, Type, Modality } = require("@google/genai");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const ai = new GoogleGenAI({ apiKey: "AIzaSyCaPISFNtOzYapi2o1QMl_vOjPNtAaYVhU" });

const SUPPORTED_AUDIO_TYPES = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mp3',
  '.aiff': 'audio/aiff',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac'
};

const getAudioMimeType = (filenameOrUrl) => {
  const extension = filenameOrUrl.substring(filenameOrUrl.lastIndexOf('.')).toLowerCase();
  return SUPPORTED_AUDIO_TYPES[extension] || null;
};

const processAudioAnalysis = async (audioData, mimeType) => {
  const contents = [
    { 
      text: "Please analyze this audio and provide: complete transcript, summary, sentiment analysis, and speaker characteristics."
    },
    {
      inlineData: {
        mimeType,
        data: audioData.toString('base64')
      }
    }
  ];

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents,
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

  return JSON.parse(response.text);
};

app.get('/api/audio', async (req, res) => {
  try {
    const { audioUrl } = req.query;
    if (!audioUrl) throw new Error("Audio URL parameter required");

    const mimeType = getAudioMimeType(audioUrl);
    if (!mimeType) throw new Error("Unsupported audio format");

    const response = await axios.get(audioUrl, { responseType: 'arraybuffer' });
    const audioBuffer = Buffer.from(response.data, 'binary');
    
    const result = await processAudioAnalysis(audioBuffer, mimeType);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/audio', async (req, res) => {
  try {
    const { audioBuffer, filename } = req.body;
    if (!audioBuffer) throw new Error("Audio buffer is required");
    if (!filename) throw new Error("Filename is required");

    const mimeType = getAudioMimeType(filename);
    if (!mimeType) throw new Error("Unsupported audio format");

    const buffer = Buffer.from(audioBuffer, 'base64');
    const result = await processAudioAnalysis(buffer, mimeType);
    res.json(result);
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
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: Buffer.from(response.data, 'binary').toString('base64')
        }
      });
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] }
    });

    const imagePart = result.candidates[0].content.parts.find(part => part.inlineData);
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
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      contents.push({
        inlineData: {
          mimeType: "image/png",
          data: Buffer.from(response.data, 'binary').toString('base64')
        }
      });
    }

    const result = await ai.models.generateContent({
      model: "gemini-2.0-flash-preview-image-generation",
      contents,
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] }
    });

    const output = { text: null, imageBase64: null };
    
    result.candidates[0].content.parts.forEach(part => {
      if (part.text) {
        output.text = part.text;
      } else if (part.inlineData) {
        output.imageBase64 = part.inlineData.data;
      }
    });

    if (!output.text && !output.imageBase64) throw new Error("No content generated");
    res.json(output);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/geminiV3', async (req, res) => {
  try {
    const { prompt } = req.query;
    if (!prompt) throw new Error("Prompt parameter required");

    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      history: []
    });

    const response = await chat.sendMessage({
      message: prompt
    });

    res.json({ response: response.text });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/geminiV3', async (req, res) => {
  try {
    const { prompt, history } = req.body;
    if (!prompt) throw new Error("Prompt parameter required");

    const chat = ai.chats.create({
      model: "gemini-2.0-flash",
      history: history || []
    });

    const response = await chat.sendMessage({
      message: prompt
    });

    res.json({ 
      response: response.text,
      updatedHistory: [
        ...(history || []),
        { role: "user", parts: [{ text: prompt }] },
        { role: "model", parts: [{ text: response.text }] }
      ]
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
