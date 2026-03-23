const form = document.getElementById('checker-form');
const statusEl = document.getElementById('status');
const resultsSection = document.getElementById('results');
const resultTableWrapEl = document.getElementById('result-table-wrap');
const submitBtn = document.getElementById('submit-btn');
const progressBarEl = document.getElementById('progress-bar');

window.addEventListener('DOMContentLoaded', async () => {
    buildProgressBar();
    updateProgressBar(0);
    await loadDefaults();
});

function setStatus(message, isError = false) {
    statusEl.textContent = message;
    statusEl.className = isError ? 'status error' : 'status';
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
                ? `<td>${escapeHtml(item.distance ?? '')}</td>`
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

async function loadDefaults() {
    const response = await fetch('/api/config');
    const defaults = await response.json();

    document.getElementById('wordsNum').value = defaults.wordsNum;
    document.getElementById('simMinLimit').value = defaults.simMinLimit;
    document.getElementById('simMaxLimit').value = defaults.simMaxLimit;
    document.getElementById('isDistanceShown').checked = defaults.isDistanceShown;
    document.getElementById('requestDelayMs').value = defaults.requestDelayMs;
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
        wordsNum: Number(document.getElementById('wordsNum').value),
        simMinLimit: Number(document.getElementById('simMinLimit').value),
        simMaxLimit: Number(document.getElementById('simMaxLimit').value),
        isDistanceShown: document.getElementById('isDistanceShown').checked,
        requestDelayMs: Number(document.getElementById('requestDelayMs').value)
    };

    if (payload.simMaxLimit <= payload.simMinLimit) {
        setStatus('Maximum similarity must be greater than minimum similarity.', true);
        return;
    }

    submitBtn.disabled = true;
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
            throw new Error(wordsData.error || 'Failed to prepare words list.');
        }

        const {config, words, totalWords} = wordsData;
        const results = [];

        for (let i = 0; i < words.length; i += 1) {
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
                throw new Error(checkData.error || `Failed while checking "${word}".`);
            }

            if (
                checkData.similarity != null &&
                checkData.similarity > config.simMinLimit &&
                checkData.similarity < config.simMaxLimit
            ) {
                results.push(checkData);
                renderResults(config, results);
            }

            if (current < totalWords && config.requestDelayMs > 0) {
                await sleep(config.requestDelayMs);
            }
        }

        renderResults(config, results);
        updateProgressBar(100);
        setStatus(`Done. Checked ${totalWords} words. and found ${results.length} matching words.`);
    } catch (error) {
        setStatus(error.message || 'Something went wrong.', true);
    } finally {
        submitBtn.disabled = false;
    }
});

function buildProgressBar() {
    if (!progressBarEl) {
        return;
    }

    progressBarEl.innerHTML = '';

    for (let i = 0; i < 100; i += 1) {
        const cell = document.createElement('div');
        cell.className = 'progress-cell';
        progressBarEl.appendChild(cell);
    }
}

function updateProgressBar(percent) {
    if (!progressBarEl) {
        return;
    }

    const cells = progressBarEl.children;
    const activeCells = Math.max(0, Math.min(100, percent));

    for (let i = 0; i < cells.length; i += 1) {
        cells[i].classList.toggle('active', i < activeCells);
    }
}