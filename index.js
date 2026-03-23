import express from 'express';
import path, {dirname} from 'path';
import {fileURLToPath} from 'url';
import {checkWord, getWords} from './semantle.js';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 8080;

const defaultConfig = {
    wordsNum: Number(process.env.COUNT_WORDS) || 1000,
    simMinLimit: Number(process.env.SIM_MIN) || 40,
    simMaxLimit: Number(process.env.SIM_MAX) || 60,
    isDistanceShown: process.env.SHOW_DISTANCE === 'true',
    requestDelayMs: Number(process.env.REQUEST_DELAY_MS) || 800
};

function normalizeConfig(input = {}) {
    const wordsNum = Math.min(Math.max(Number(input.wordsNum) || defaultConfig.wordsNum, 1), 10000);
    const simMinLimit = Math.min(Math.max(Number(input.simMinLimit) || defaultConfig.simMinLimit, 1), 99);
    const simMaxLimit = Math.min(
        Math.max(Number(input.simMaxLimit) || defaultConfig.simMaxLimit, simMinLimit + 1),
        100
    );
    const isDistanceShown =
        typeof input.isDistanceShown === 'boolean'
            ? input.isDistanceShown
            : defaultConfig.isDistanceShown;

    const requestDelayMs = Math.max(
        Number(input.requestDelayMs) || defaultConfig.requestDelayMs,
        0
    );

    if (simMaxLimit <= simMinLimit) {
        throw new Error('Maximum similarity must be greater than minimum similarity.');
    }

    return {
        wordsNum,
        simMinLimit,
        simMaxLimit,
        isDistanceShown,
        requestDelayMs
    };
}

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (req, res) => {
    res.json(defaultConfig);
});

app.post('/api/words-list', (req, res) => {
    try {
        const config = normalizeConfig(req.body);
        const words = getWords(config.wordsNum);

        res.json({
            config,
            totalWords: words.length,
            words
        });
    } catch (error) {
        res.status(400).json({
            error: error.message || 'Failed to prepare words list.'
        });
    }
});

app.post('/api/check-word', async (req, res) => {
    try {
        const word = String(req.body.word || '').trim();

        if (!word) {
            throw new Error('Word is required.');
        }

        const result = await checkWord(word);
        res.json(result);
    } catch (error) {
        res.status(400).json({
            error: error.message || 'Failed to check word.'
        });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Running on http://localhost:${PORT}`);
});