import express from 'express';
import { spawn, spawnSync } from 'child_process';
import path from 'path';
const port = 8080;
const app = express();
import fs from 'fs';

import cors from 'cors';
app.use(cors());

// Detect correct Python executable — prefer whichever has yt_dlp installed
function getPythonExecutable() {
    const candidates = [
        'python3', 'python',
        'c:/python314/python.exe',
        'c:/python313/python.exe',
        'c:/python312/python.exe',
        'c:/python311/python.exe',
    ];
    // First pass: find a Python that has yt_dlp
    for (const cmd of candidates) {
        const result = spawnSync(cmd, ['-c', 'import yt_dlp'], { stdio: 'ignore' });
        if (result.status === 0) return cmd;
    }
    // Second pass: any Python that runs at all
    for (const cmd of candidates) {
        const result = spawnSync(cmd, ['--version'], { stdio: 'ignore' });
        if (result.status === 0) return cmd;
    }
    throw new Error('No Python executable with yt_dlp found. Run: pip install yt-dlp');
}

const PYTHON = getPythonExecutable();
console.log(`Using Python executable: ${PYTHON}`);



app.get('/formats', (req, res) => {
    const videoUrl = req.query.url;
    if (!videoUrl) return res.status(400).json({ error: 'Missing URL' });

    const scriptPath = path.resolve('./yt_dlp_handler/main.py');

    const python = spawn(PYTHON, [scriptPath, 'formats', videoUrl]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    python.on('close', (code) => {
        if (code !== 0) {
            console.error(`Script error: ${stderr}`);
            return res.status(500).json({ error: 'Failed to get formats' });
        }

        try {
            const formats = JSON.parse(stdout);
            // console.log(formats);
            res.status(200).json(formats );
        } catch (e) {
            console.error(`JSON parse error: ${e}`);
            res.status(500).json({ error: 'Failed to parse formats' });
        }
    });
});

app.get('/download', (req, res) => {
    const { url, format } = req.query;
    if (!url || !format) return res.status(400).json({ error: 'Missing parameters' });

    console.log(url , format);

    const scriptPath = path.resolve('./yt_dlp_handler/main.py');
    const python = spawn(PYTHON, [scriptPath, 'download', url, format]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', data => { stdout += data.toString(); });
    python.stderr.on('data', data => { stderr += data.toString(); });

    python.on('close', code => {
        if (code !== 0) {
            console.error('Error:', stderr);
            return res.status(500).json({ error: 'Download failed' });
        }

        try {
            const { filename } = JSON.parse(stdout);
            
            if (!filename || typeof filename !== 'string') {
                console.error('Download failed: Invalid filename returned');
                console.error('Python stderr:', stderr);
                console.error('Python stdout:', stdout);
                return res.status(500).json({ error: 'Download failed - check logs for details' });
            }
            
            // File already saved to Downloads folder by Python
            console.log(`File downloaded successfully: ${filename}`);
            res.status(200).json({ 
                success: true, 
                filename: filename,
                message: 'Video downloaded to Downloads folder'
            });
        } catch (e) {
            console.error('Parse error:', e);
            res.status(500).json({ error: 'Invalid response from Python' });
            
        }
    });
});


app.get('/get-download-url', (req, res) => {
    const { url, format } = req.query;

    if (!url || !format) {
        return res.status(400).json({ error: 'Missing parameters' });
    }

    const scriptPath = path.resolve('./yt_dlp_handler/main.py');

    const python = spawn(PYTHON, [scriptPath, 'get_url', url, format]);

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    python.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    python.on('close', (code) => {
        if (code !== 0) {
            console.error(`Script error: ${stderr}`);
            return res.status(500).json({ error: 'Failed to get URL' });
        }

        try {
            const data = JSON.parse(stdout);
            res.status(200).json(data);
        } catch (e) {
            console.error(`JSON parse error: ${e}`);
            res.status(500).json({ error: 'Failed to parse direct URL' });
        }
    });
});

app.listen(port, () => {
    console.log(`App is listening at port: ${port}`);
})

