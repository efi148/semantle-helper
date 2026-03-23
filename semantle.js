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
        result = JSON.parse(rawText);
    } catch {
        throw new Error('Semantle API returned invalid JSON.');
    }
    //
    const similarity = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99, -12, 15, 25, 55, 45, 65, 75, 53, 51, 64, 91, 33];
    const distance = [999, 998, 12, 45, 78, 98, 65, 32, 36, 52, 158, 478, 492, 222, 321, 654, 789, 432, 123, 345, 567, 890, 123];

    function getRandomValue(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    const randomSimilarity = getRandomValue(similarity);
    const randomDistance = getRandomValue(distance);
    //

    return {
        word: wordToCheck,
        similarity: randomSimilarity,// result.similarity,
        distance: randomDistance// result.distance
    };
}

export function isWordInRange(item, similarityMinLimit, similarityMaxLimit) {
    return (
        item.similarity != null &&
        item.similarity > similarityMinLimit &&
        item.similarity < similarityMaxLimit
    );
}