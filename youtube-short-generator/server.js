import express from 'express';
import ffmpeg from 'fluent-ffmpeg';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

async function downloadFile(url, outputPath) {
  const writer = fs.createWriteStream(outputPath);
  const response = await axios({ url, method: 'GET', responseType: 'stream' });
  response.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

function createVideoWithAudio(imagePath, audioPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg()
      .addInput(imagePath)
      .loop(1)
      .addInput(audioPath)
      .outputOptions([
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-pix_fmt', 'yuv420p',
        '-shortest'
      ])
      .size('1080x1920')
      .on('start', cmd => console.log('FFmpeg command:', cmd))
      .on('error', (err, stdout, stderr) => {
        console.error('FFmpeg error:', err.message);
        console.error('stderr:', stderr);
        reject(err);
      })
      .on('end', () => {
        console.log('✅ Video created successfully');
        resolve();
      })
      .save(outputPath);
  });
}

app.get('/', (req, res) => {
  res.send('✅ Server is up and running.');
});

app.post('/', async (req, res) => {
  const { imageUrl, audioUrl } = req.body;
  if (!imageUrl || !audioUrl) {
    return res.status(400).send('Missing imageUrl or audioUrl');
  }

  const imagePath = path.resolve('input.jpg');
  const audioPath = path.resolve('voice.mp3');
  const outputPath = path.resolve('output.mp4');

  try {
    [imagePath, audioPath, outputPath].forEach(file => {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    });

    console.log('📥 Downloading image...');
    await downloadFile(imageUrl, imagePath);

    console.log('🎧 Downloading audio...');
    await downloadFile(audioUrl, audioPath);

    console.log('🎬 Creating video...');
    await createVideoWithAudio(imagePath, audioPath, outputPath);

    if (!fs.existsSync(outputPath)) {
      return res.status(500).send('Video not created');
    }

    res.setHeader('Content-Type', 'video/mp4');
    res.sendFile(outputPath, err => {
      if (err) {
        console.error('Error sending file:', err);
        res.status(500).send('Error sending video');
      }
      [imagePath, audioPath, outputPath].forEach(file => {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      });
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).send('Internal Server Error');
  }
});

process.on('uncaughtException', err => {
  console.error('Uncaught Exception:', err);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});