let testData = null;
let timerInterval = null;
let timeLeft = 0;
let totalTime = 0;
let isTestRunning = false;
let testStartTime = null;
let savedTypedText = '';

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('main-navbar').innerHTML = createNavbar('typing');
    redirectIfNotLoggedIn();
    
    initNavbar();
    
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('id');
    
    if (!testId) {
        showToast("Invalid Test ID", "error");
        setTimeout(() => window.location.href = 'steno-tests.html', 2000);
        return;
    }
    
    await loadTestData(testId);
    
    // Auto-save logic
    setInterval(() => {
        if (isTestRunning) {
            savedTypedText = document.getElementById('typing-textarea').value;
            localStorage.setItem(`hcsw_draft_${testId}`, savedTypedText);
        }
    }, 30000);
    
    // Input event for live wpm/word count
    document.getElementById('typing-textarea').addEventListener('input', updateStats);
});

async function loadTestData(id) {
    showLoading();
    try {
        const doc = await window.db.collection('tests').doc(id).get();
        if (!doc.exists) {
            throw new Error("Test not found");
        }
        
        testData = { id: doc.id, ...doc.data() };
        
        document.getElementById('test-title').innerText = testData.name;
        document.getElementById('test-speed').innerText = testData.speed || 'N/A';
        document.getElementById('test-total-words').innerText = testData.totalWords || '0';
        document.getElementById('test-duration').innerText = testData.typeDuration || 'N/A';
        
        if (testData.type === 'typing') {
            document.getElementById('audio-container').style.display = 'none';
            document.getElementById('typing-text-container').style.display = 'block';
            document.getElementById('typing-text-container').innerText = testData.textContent || 'No text provided for this test.';
        } else {
            document.getElementById('typing-text-container').style.display = 'none';
            // Setup Audio if available for steno
            if (testData.audioUrl) {
                document.getElementById('audio-container').style.display = 'block';
                
                let finalUrl = testData.audioUrl;
                // Convert Google Drive view links to direct streaming links
                if (finalUrl.includes('drive.google.com')) {
                    const match = finalUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || finalUrl.match(/id=([a-zA-Z0-9_-]+)/);
                    if (match && match[1]) {
                        finalUrl = `https://drive.google.com/uc?export=download&id=${match[1]}`;
                    }
                }
                
                const audioEl = document.getElementById('test-audio');
                audioEl.src = finalUrl;
            } else {
                document.getElementById('no-audio-msg') && (document.getElementById('no-audio-msg').style.display = 'block');
            }
        }
        
        // Parse time (assuming format like "45Mins" or "45")
        let minutes = 45; // default
        if (testData.typeDuration) {
            const m = testData.typeDuration.match(/(\d+)/);
            if (m) minutes = parseInt(m[1]);
        }
        totalTime = minutes * 60;
        timeLeft = totalTime;
        updateTimerDisplay();
        
        // Recover draft if exists
        const draft = localStorage.getItem(`hcsw_draft_${id}`);
        if (draft) {
            document.getElementById('typing-textarea').value = draft;
            savedTypedText = draft;
            updateStats();
        }
        
    } catch (error) {
        console.error(error);
        showToast("Error: " + error.message, "error");
    } finally {
        hideLoading();
    }
}

function startDictation() {
    const btn = document.getElementById('btn-start-dictation');
    btn.disabled = true;
    const audio = document.getElementById('test-audio');
    
    // Trick to unlock audio on strict browsers: Play and pause immediately on click
    audio.muted = true;
    audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
    }).catch(e => console.log("Unlock warning:", e));
    
    let countdown = 3;
    btn.innerText = `Starting in ${countdown}...`;
    
    const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            btn.innerText = `Starting in ${countdown}...`;
        } else {
            clearInterval(interval);
            btn.style.display = 'none';
            audio.play().catch(e => {
                console.error(e);
                showToast("Error: " + (e.message || e.name) + ". Please check Google Drive link permissions.", "error");
            });
            showToast("🔊 डिक्टेशन शुरू हो गया है! अपना नोटबुक तैयार रखें।", "success");
        }
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById('timer-display').innerText = formatTime(timeLeft);
    const progress = ((totalTime - timeLeft) / totalTime) * 100;
    document.getElementById('test-progress').style.width = `${progress}%`;
}

function startTestEngine() {
    if (!testData) return;
    
    isTestRunning = true;
    testStartTime = new Date();
    
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-submit').style.display = 'inline-block';
    
    const textarea = document.getElementById('typing-textarea');
    textarea.disabled = false;
    textarea.focus();
    
    // Stop Audio (dictation phase ends, typing phase begins)
    if (testData.audioUrl) {
        const audio = document.getElementById('test-audio');
        audio.pause();
        audio.currentTime = 0;
    }
    
    // Start Timer
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        updateStats();
        
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            autoSubmit();
        }
    }, 1000);
}

function updateStats() {
    if (!isTestRunning) return;
    
    const text = document.getElementById('typing-textarea').value;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0);
    const typedWordsCount = words.length;
    
    document.getElementById('typed-words-count').innerText = typedWordsCount;
    
    // Calculate WPM
    const timeElapsedSec = totalTime - timeLeft;
    if (timeElapsedSec > 0) {
        const wpm = Math.round((typedWordsCount / timeElapsedSec) * 60);
        document.getElementById('live-wpm').innerText = wpm;
    }
}

function setSpeed(speed) {
    const audio = document.getElementById('test-audio');
    if (audio) audio.playbackRate = speed;
}

function showSubmitConfirm() {
    const modal = document.getElementById('submit-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

async function autoSubmit() {
    showToast("Time's up! Auto-submitting...", "info");
    await submitTest();
}

function evaluateTest(originalWords, typedWords) {
    const n = originalWords.length;
    const m = typedWords.length;
    const getCore = w => w.replace(/[.,?!;:'"\|\u0964\u0965\-]/g, '');
    
    const dp = Array.from(Array(n + 1), () => Array(m + 1));
    dp[0][0] = { f: 0, h: 0, op: null, prevI: 0, prevJ: 0 };
    
    for (let i = 1; i <= n; i++) dp[i][0] = { f: i, h: 0, op: 'del', prevI: i-1, prevJ: 0 };
    for (let j = 1; j <= m; j++) dp[0][j] = { f: j, h: 0, op: 'ins', prevI: 0, prevJ: j-1 };
    
    for (let i = 1; i <= n; i++) {
        for (let j = 1; j <= m; j++) {
            const o = originalWords[i-1];
            const t = typedWords[j-1];
            
            let costF = 0, costH = 0, op = 'sub';
            if (o === t) { costF = 0; costH = 0; op = 'match'; }
            else if (getCore(o) === getCore(t)) { costF = 0; costH = 1; op = 'half'; }
            else { costF = 1; costH = 0; op = 'sub'; }
            
            const sub = { f: dp[i-1][j-1].f + costF, h: dp[i-1][j-1].h + costH, op: op, prevI: i-1, prevJ: j-1 };
            const del = { f: dp[i-1][j].f + 1, h: dp[i-1][j].h, op: 'del', prevI: i-1, prevJ: j };
            const ins = { f: dp[i][j-1].f + 1, h: dp[i][j-1].h, op: 'ins', prevI: i, prevJ: j-1 };
            
            const weight = (s) => s.f + 0.5 * s.h;
            let minState = sub;
            if (weight(del) < weight(minState)) minState = del;
            if (weight(ins) < weight(minState)) minState = ins;
            dp[i][j] = minState;
        }
    }
    
    const ops = [];
    let currI = n, currJ = m;
    while (currI > 0 || currJ > 0) {
        const state = dp[currI][currJ];
        ops.push(state.op);
        currI = state.prevI;
        currJ = state.prevJ;
    }
    ops.reverse();
    
    let html = '';
    let i = 0, j = 0;
    for (const op of ops) {
        if (op === 'match') {
            html += `<span style="color: var(--success);">${escapeHtml(typedWords[j])}</span> `;
            i++; j++;
        } else if (op === 'half') {
            html += `<span style="color: var(--warning);" title="Correct: ${escapeHtml(originalWords[i])}">${escapeHtml(typedWords[j])}</span> `;
            i++; j++;
        } else if (op === 'sub') {
            html += `<span style="color: var(--error);" title="Correct: ${escapeHtml(originalWords[i])}">${escapeHtml(typedWords[j])}</span> `;
            i++; j++;
        } else if (op === 'del') {
            html += `<span style="color: var(--error); text-decoration: line-through;" title="Omitted">${escapeHtml(originalWords[i])}</span> `;
            i++;
        } else if (op === 'ins') {
            html += `<span style="color: var(--error);" title="Extra word">${escapeHtml(typedWords[j])}</span> `;
            j++;
        }
    }
    
    return {
        fullMistakes: dp[n][m].f,
        halfMistakes: dp[n][m].h,
        html: html
    };
}

async function submitTest() {
    if (timerInterval) clearInterval(timerInterval);
    isTestRunning = false;
    closeModal('submit-modal');
    
    showLoading();
    
    try {
        const user = getCurrentUser();
        const typedText = document.getElementById('typing-textarea').value;
        const typedWordsArr = typedText.trim().split(/\s+/).filter(w => w.length > 0);
        const originalWordsArr = (testData.textContent || "").trim().split(/\s+/).filter(w => w.length > 0);
        
        const totalTyped = typedWordsArr.length;
        const totalOriginal = originalWordsArr.length;
        
        // Use High Court Evaluation Algorithm
        const evaluation = evaluateTest(originalWordsArr, typedWordsArr);
        const fullMistakes = evaluation.fullMistakes;
        const halfMistakes = evaluation.halfMistakes;
        
        // 2 half mistakes = 1 full mistake
        const actualCommitted = fullMistakes + (halfMistakes / 2);
        const permissible = totalOriginal * 0.05; // 5% allowance
        
        let actualCorrect = totalOriginal - actualCommitted;
        if (actualCorrect < 0) actualCorrect = 0;
        
        // Calculate Marks (out of 100)
        let marks = 0;
        if (totalOriginal > 0) {
            marks = (actualCorrect * 100) / totalOriginal;
        }
        
        // Calculate Speed (WPM)
        const durationInMinutes = totalTime > 0 ? (totalTime / 60) : 1;
        const minMistakes = Math.min(permissible, actualCommitted);
        const speedWPM = (actualCorrect + minMistakes) / durationInMinutes;
        
        const resultData = {
            userId: user.uid,
            testId: testData.id,
            testName: testData.name,
            totalWords: totalOriginal || testData.totalWords,
            totalTyped: totalTyped,
            fullMistakes: fullMistakes,
            halfMistakes: halfMistakes,
            actualCommitted: actualCommitted,
            incorrect: actualCommitted, // keep for backward compatibility
            marks: parseFloat(marks.toFixed(2)),
            speedWPM: Math.round(speedWPM),
            compareHtml: evaluation.html,
            typedText: typedText,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await window.db.collection('results').add(resultData);
        
        // Clear draft
        localStorage.removeItem(`hcsw_draft_${testData.id}`);
        
        showToast("टेस्ट सफलतापूर्वक सबमिट हो गया है!", "success");
        setTimeout(() => {
            window.location.href = 'scorecard.html';
        }, 1500);
        
    } catch (error) {
        console.error(error);
        showToast("Error submitting test", "error");
        hideLoading();
    }
}

// Warn before leaving
window.addEventListener('beforeunload', (e) => {
    if (isTestRunning) {
        e.preventDefault();
        e.returnValue = '';
    }
});
