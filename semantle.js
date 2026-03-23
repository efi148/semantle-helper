import {getWordsList} from 'most-common-words-by-language';
import fetch from 'node-fetch';

const LANG = 'hebrew';
export const SEMANTLE_API_URL =
    process.env.SEMANTLE_API_URL || 'https://semantle.ishefi.com/api/distance';

export function getWords(wordsNum = 1000) {
    const safeWordsNum = Math.min(Math.max(Number(wordsNum) || 1000, 1), 10000);
    return getWordsList(LANG, safeWordsNum);
}

export async function checkWord(wordToCheck) {
    const response = await fetch(
        `${SEMANTLE_API_URL}?word=${encodeURIComponent(wordToCheck)}`
    );

    const contentType = response.headers.get('content-type') || '';
    const rawText = await response.text();
    if (!response.statusText) {
        throw new Error(`Semantle API request failed with status ${response.status}.`);
    }

    if (!contentType.includes('application/json')) {
        throw new Error('Semantle API returned non JSON response.');
    }

    let result;
    try {
        result = JSON.parse(rawText)[0];
    } catch {
        throw new Error('Semantle API returned invalid JSON.');
    }

    return {
        word: wordToCheck,
        similarity: result.similarity,
        distance: result.distance
    };
}

export function isWordInRange(item, similarityMinLimit, similarityMaxLimit) {
    return (
        item.similarity != null &&
        item.similarity > similarityMinLimit &&
        item.similarity < similarityMaxLimit
    );
}