const STORAGE_KEYS = {
    COUNT_WORDS: 'COUNT_WORDS',
    SIM_MIN: 'SIM_MIN',
    SIM_MAX: 'SIM_MAX'
};

const form = document.getElementById('checker-form');
const statusEl = document.getElementById('status');
const resultsSection = document.getElementById('results');
const resultTableWrapEl = document.getElementById('result-table-wrap');
const submitBtn = document.getElementById('submit-btn');
const abortBtn = document.getElementById('abort-btn');
const resetBtn = document.getElementById('reset-btn');
const progressFillEl = document.getElementById('progress-fill');

const wordsNumInput = document.getElementById('wordsNum');
const simMinInput = document.getElementById('simMinLimit');
const simMaxInput = document.getElementById('simMaxLimit');

const wordsNumHelpEl = document.getElementById('wordsNum-help');
const simMinHelpEl = document.getElementById('simMinLimit-help');
const simMaxHelpEl = document.getElementById('simMaxLimit-help');

const exportBtn = document.getElementById('export-btn');

let appConfig = null;
let shouldAbort = false;
let isChecking = false;
let latestResults = [];

window.addEventListener('DOMContentLoaded', async () => {
    buildProgressBar();
    updateProgressBar(0);
    await initializeApp();
    exportBtn.disabled = true;
});

function setFormDisabled(disabled) {
    const inputs = form.querySelectorAll('input');

    inputs.forEach((el) => {
        el.disabled = disabled;
    });

    submitBtn.disabled = disabled;
    abortBtn.disabled = !disabled;
    resetBtn.disabled = disabled;
    exportBtn.disabled = disabled;

    submitBtn.textContent = disabled ? 'Checking...' : 'Check words';

    form.classList.toggle('form-disabled', disabled);
}

function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? 'status status-error' : 'status';
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderResults(config, results) {
    latestResults = [...results];

    const sortedResults = [...results].sort((a, b) => b.similarity - a.similarity);

    if (!sortedResults.length) {
        resultTableWrapEl.innerHTML = '<div class="result-item">No words were found with these settings.</div>';
        resultsSection.classList.remove('hidden');
        return;
    }

    const distanceHeader = config.isDistanceShown ? '<th>Distance</th>' : '';
    const rows = sortedResults
        .map((item) => {
            const distanceCell = config.isDistanceShown
                ? `<td>${escapeHtml(item.distance === -1 ? 'far' : item.distance)}</td>`
                : '';

            return `
        <tr>
          <td>${escapeHtml(item.word)}</td>
          <td>${escapeHtml(item.similarity)}</td>
          ${distanceCell}
        </tr>
      `;
        })
        .join('');

    resultTableWrapEl.innerHTML = `
    <table class="results-table">
      <thead>
        <tr>
          <th>Word</th>
          <th>Similarity</th>
          ${distanceHeader}
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;

    resultsSection.classList.remove('hidden');
}

async function initializeApp() {
    const response = await fetch('/api/config');
    const defaults = await response.json();

    appConfig = {
        ...defaults,
        isDistanceShown: true
    };

    applyHelpText(appConfig);
    loadSettingsIntoForm(appConfig);
}

function applyHelpText(config) {
    wordsNumHelpEl.textContent = `Default: ${config.wordsNum}`;
    simMinHelpEl.textContent = `Default: ${config.simMinLimit}`;
    simMaxHelpEl.textContent = `Default: ${config.simMaxLimit}`;
}

function getStoredNumber(key) {
    const rawValue = localStorage.getItem(key);

    if (rawValue == null || rawValue === '') {
        return null;
    }

    const parsed = Number(rawValue);
    return Number.isFinite(parsed) ? parsed : null;
}

function loadSettingsIntoForm(config) {
    wordsNumInput.value = getStoredNumber(STORAGE_KEYS.COUNT_WORDS) ?? config.wordsNum;
    simMinInput.value = getStoredNumber(STORAGE_KEYS.SIM_MIN) ?? config.simMinLimit;
    simMaxInput.value = getStoredNumber(STORAGE_KEYS.SIM_MAX) ?? config.simMaxLimit;
}

function persistSettings(payload) {
    localStorage.setItem(STORAGE_KEYS.COUNT_WORDS, String(payload.wordsNum));
    localStorage.setItem(STORAGE_KEYS.SIM_MIN, String(payload.simMinLimit));
    localStorage.setItem(STORAGE_KEYS.SIM_MAX, String(payload.simMaxLimit));
}

function clearStoredSettings() {
    localStorage.removeItem(STORAGE_KEYS.COUNT_WORDS);
    localStorage.removeItem(STORAGE_KEYS.SIM_MIN);
    localStorage.removeItem(STORAGE_KEYS.SIM_MAX);
}

function getPayloadFromForm() {
    return {
        wordsNum: Number(wordsNumInput.value),
        simMinLimit: Number(simMinInput.value),
        simMaxLimit: Number(simMaxInput.value),
        isDistanceShown: true,
        requestDelayMs: Number(appConfig?.requestDelayMs || 0)
    };
}

function formatResultsAsText(results) {
    const sortedResults = [...results].sort((a, b) => b.similarity - a.similarity);

    if (!sortedResults.length) {
        return 'No words were found with these settings.';
    }

    const lines = sortedResults.map((item) => {
        const parts = [
            item.word,
            `similarity: ${item.similarity}`
        ];

        parts.push(`distance: ${item.distance === -1 ? 'far' : item.distance}`);

        return parts.join(', ');
    });

    return lines.join('\n');
}

function isMobileDevice() {
    return window.matchMedia('(max-width: 768px)').matches || navigator.maxTouchPoints > 0;
}

async function exportResults(results) {
    const text = formatResultsAsText( results);

    if (!text) {
        setStatus('There are no results to export.', true);
        return;
    }

    try {
        if (isMobileDevice() && navigator.share) {
            await navigator.share({
                text
            });
            setStatus('Results shared.');
            return;
        }

        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text);
            setStatus('Results copied to clipboard.');
            return;
        }

        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.setAttribute('readonly', '');
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        setStatus('Results copied to clipboard.');
    } catch (error) {
        setStatus('Failed to export results.', true);
    }
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = getPayloadFromForm();

    if (payload.simMaxLimit <= payload.simMinLimit) {
        setStatus('Maximum similarity must be greater than minimum similarity.', true);
        return;
    }

    persistSettings(payload);

    shouldAbort = false;
    isChecking = true;
    setFormDisabled(true);
    resultsSection.classList.remove('hidden');
    resultTableWrapEl.innerHTML = '<div class="result-item">No matching words yet.</div>';
    updateProgressBar(0);
    setStatus('Preparing words list...');

    try {
        const wordsResponse = await fetch('/api/words-list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const wordsData = await wordsResponse.json();

        if (!wordsResponse.ok) {
            setStatus(wordsData.error || 'Failed to prepare words list.', true);
            return;
        }

        const {config, words, totalWords} = wordsData;
        const normalizedConfig = {
            ...config,
            isDistanceShown: true
        };
        const results = [];

        for (let i = 0; i < words.length; i += 1) {
            if (shouldAbort) {
                setStatus(`Aborted. Checked ${i} of ${totalWords} words.`);
                renderResults(normalizedConfig, results);
                updateProgressBar(totalWords ? Math.round((i / totalWords) * 100) : 0);
                return;
            }

            const word = words[i];
            const current = i + 1;
            const percent = Math.round((current / totalWords) * 100);

            setStatus(`Checked ${current} of ${totalWords} words (${percent}%)`);
            updateProgressBar(percent);

            const checkResponse = await fetch('/api/check-word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({word})
            });

            const checkData = await checkResponse.json();

            if (!checkResponse.ok) {
                setStatus(checkData.error || `Failed while checking "${word}".`, true);
                return;
            }

            if (
                checkData.similarity != null &&
                checkData.similarity > normalizedConfig.simMinLimit &&
                checkData.similarity < normalizedConfig.simMaxLimit
            ) {
                results.push(checkData);
                renderResults(normalizedConfig, results);
            }

            if (!shouldAbort && current < totalWords && normalizedConfig.requestDelayMs > 0) {
                await sleep(normalizedConfig.requestDelayMs);
            }
        }

        renderResults(normalizedConfig, results);
        updateProgressBar(100);
        setStatus(`Done. Checked ${totalWords} words and found ${results.length} matching words.`);
    } catch (error) {
        setStatus(error.message || 'Something went wrong.', true);
    } finally {
        isChecking = false;
        setFormDisabled(false);
    }
});

abortBtn.addEventListener('click', () => {
    if (!isChecking) {
        return;
    }

    shouldAbort = true;
    abortBtn.disabled = true;
    setStatus('Abort requested...');
});

resetBtn.addEventListener('click', () => {
    if (!appConfig || isChecking) {
        return;
    }

    clearStoredSettings();
    loadSettingsIntoForm(appConfig);
    updateProgressBar(0);
    setStatus('Settings were reset to default values.');
    resultsSection.classList.add('hidden');
    resultTableWrapEl.innerHTML = '';
});

exportBtn.addEventListener('click', async () => {
    if (!latestResults.length) {
        setStatus('There are no results to export.', true);
        return;
    }

    await exportResults(latestResults);
});

function buildProgressBar() {
    if (!progressFillEl) {
        return;
    }

    progressFillEl.style.width = '0%';
}

function updateProgressBar(percent) {
    if (!progressFillEl) {
        return;
    }

    const safePercent = Math.max(0, Math.min(100, percent));
    progressFillEl.style.width = `${safePercent}%`;
}