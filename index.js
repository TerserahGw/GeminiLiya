const express = require('express');
const axios = require('axios');
const { GoogleGenAI, Modality } = require("@google/genai");
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const tmpDir = path.join(__dirname, 'tmp');

if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

const ai = new GoogleGenAI({ apiKey: "AIzaSyCaPISFNtOzYapi2o1QMl_vOjPNtAaYVhU" });

const generateRandomDigits = (length) => {
  return Math.floor(Math.pow(10, length-1) + Math.random() * 9 * Math.pow(10, length-1));
};

const getImageBase64 = async (imageUrl) => {
  const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
  return Buffer.from(response.data, 'binary').toString('base64');
};

const cleanupOldFiles = () => {
  fs.readdir(tmpDir, (err, files) => {
    if (err) return;
    files.forEach(file => {
      const filePath = path.join(tmpDir, file);
      if (Date.now() - fs.statSync(filePath).birthtimeMs > 3600000) {
        fs.unlinkSync(filePath);
      }
    });
  });
};

setInterval(cleanupOldFiles, 60000);

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

    const result = { text: null, imageUrl: null };
    const hostname = req.headers.host;
    
    response.candidates[0].content.parts.forEach(part => {
      if (part.text) {
        result.text = part.text;
      } else if (part.inlineData) {
        const randomDigits = generateRandomDigits(12);
        const filename = `${randomDigits}.png`;
        fs.writeFileSync(path.join(tmpDir, filename), Buffer.from(part.inlineData.data, "base64"));
        result.imageUrl = `http://${hostname}/image/${filename}`;
      }
    });

    if (!result.text && !result.imageUrl) throw new Error("No content generated");
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/image/:filename', (req, res) => {
  const filePath = path.join(tmpDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.set('Content-Type', 'image/png');
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

app.get('/dev/clearAll', (req, res) => {
  fs.readdir(tmpDir, (err, files) => {
    if (err) return res.status(500).json({ error: err.message });
    files.forEach(file => fs.unlinkSync(path.join(tmpDir, file)));
    res.json({ success: true, message: "All temporary files cleared" });
  });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
