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
        
        // Setup Audio if available
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
            document.getElementById('no-audio-msg').style.display = 'block';
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
    
    let countdown = 3;
    btn.innerText = `Starting in ${countdown}...`;
    
    const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            btn.innerText = `Starting in ${countdown}...`;
        } else {
            clearInterval(interval);
            btn.style.display = 'none';
            const audio = document.getElementById('test-audio');
            audio.play().catch(e => {
                console.error(e);
                showToast("Browser blocked audio. Please click play manually if needed.", "error");
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
    
    // Start Audio
    if (testData.audioUrl) {
        const audio = document.getElementById('test-audio');
        audio.play().catch(e => console.log("Auto-play prevented", e));
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
    document.getElementById('submit-modal').style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

async function autoSubmit() {
    showToast("Time's up! Auto-submitting...", "info");
    await submitTest();
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
        
        // Simple comparison logic
        let correct = 0;
        let incorrect = 0;
        
        for (let i = 0; i < Math.max(totalTyped, totalOriginal); i++) {
            if (i < totalTyped && i < totalOriginal) {
                if (typedWordsArr[i] === originalWordsArr[i]) {
                    correct++;
                } else {
                    incorrect++;
                }
            } else if (i < totalTyped) {
                incorrect++; // extra typed words
            }
            // missing words are accounted for in totalOriginal vs correct
        }
        
        const missing = Math.max(0, totalOriginal - totalTyped);
        incorrect += missing; // consider missing words as incorrect for scoring
        
        // Marks logic: simplistic representation (correct/totalOriginal * 100)
        let marks = 0;
        if (totalOriginal > 0) {
            marks = (correct / totalOriginal) * 100;
        }
        
        const resultData = {
            userId: user.uid,
            testId: testData.id,
            testName: testData.name,
            totalWords: totalOriginal || testData.totalWords,
            totalTyped: totalTyped,
            incorrect: incorrect,
            marks: marks,
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
