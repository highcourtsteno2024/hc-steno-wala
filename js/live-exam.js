const urlParams = new URLSearchParams(window.location.search);
const liveExamId = urlParams.get('id');

let liveExamData = null;
let stenoTestData = null;
let typingTestData = null;
let wordTestData = null;

class LiveExamEngine {
    constructor() {
        this.phase = 'init'; // init, wait, steno_audio, steno_read, steno_trans, break1, typing, break2, word, done
        this.timerInterval = null;
        this.remainingTime = 0;
        this.stenoResults = null;
        this.typingResults = null;
        this.wordResults = null;
    }

    async start() {
        if (!liveExamId) { 
            showToast("Invalid Exam ID", "error"); 
            window.location.href = 'live-exams.html'; 
            return; 
        }

        try {
            const doc = await window.db.collection('live_exams').doc(liveExamId).get();
            if (!doc.exists) throw new Error("Exam not found");
            liveExamData = doc.data();
            document.getElementById('exam-title').innerText = liveExamData.name;

            // Load all 3 tests
            const [stenoDoc, typingDoc, wordDoc] = await Promise.all([
                window.db.collection('tests').doc(liveExamData.stenoTestId).get(),
                window.db.collection('tests').doc(liveExamData.typingTestId).get(),
                window.db.collection('tests').doc(liveExamData.wordTestId).get()
            ]);

            stenoTestData = stenoDoc.data();
            typingTestData = typingDoc.data();
            wordTestData = wordDoc.data();

            // Prepare UI for tests
            this.prepareSteno();
            this.prepareTyping();
            this.prepareWord();

            this.setPhase('wait');
        } catch(e) {
            console.error(e);
            showToast("Error loading exam data", "error");
        }
    }

    setPhase(phase) {
        this.phase = phase;
        document.getElementById('exam-phase').innerText = phase.replace('_', ' ').toUpperCase();
        
        // Hide all UI
        document.getElementById('ui-steno').classList.add('hidden');
        document.getElementById('ui-typing').classList.add('hidden');
        document.getElementById('ui-word').classList.add('hidden');
        document.getElementById('overlay-waiting').style.display = 'none';
        
        clearInterval(this.timerInterval);

        switch(phase) {
            case 'wait':
                this.showOverlay("Preparing Exam", "Get ready for Steno Dictation...", 5);
                this.startTimer(5, () => this.setPhase('steno_dictation'));
                break;
            case 'steno_dictation':
                document.getElementById('ui-steno').classList.remove('hidden');
                document.getElementById('steno-audio').play().catch(e => {
                    showToast("Please click play to start dictation", "info")<
                });
                document.getElementById('exam-timer').innerText = "DICTATION";
                break;
            case 'steno_reading':
                this.showOverlay("Reading Time", "Read your steno notes. Transcription will begin shortly.", 300); // 5 mins
                this.startTimer(300, () => this.setPhase('steno_transcription'));
                break;
            case 'steno_transcription':
                document.getElementById('ui-steno').classList.remove('hidden');
                document.getElementById('steno-audio-container').classList.add('hidden');
                document.getElementById('steno-typing-container').style.opacity = '1';
                document.getElementById('steno-typing-container').style.pointerEvents = 'all';
                document.getElementById('steno-textarea').focus();
                this.startTimer(stenoTestData.typeDuration * 60, () => {
                    this.saveStenoResults();
                    this.setPhase('break1');
                });
                break;
            case 'break1':
                this.showOverlay("Break Time", "Steno portion complete. Typing test will begin shortly.", 60);
                this.startTimer(60, () => this.setPhase('typing'));
                break;
            case 'typing':
                document.getElementById('ui-typing').classList.remove('hidden');
                document.getElementById('typing-textarea').focus();
                this.startTimer(typingTestData.typeDuration * 60, () => {
                    this.saveTypingResults();
                    this.setPhase('break2');
                });
                break;
            case 'break2':
                this.showOverlay("Break Time", "Typing portion complete. Word Efficiency test will begin shortly.", 60);
                this.startTimer(60, () => this.setPhase('word'));
                break;
            case 'word':
                document.getElementById('ui-word').classList.remove('hidden');
                document.getElementById('word-document').focus();
                this.startTimer(wordTestData.typeDuration * 60, () => this.setPhase('done'));
                break;
            case 'done':
                this.saveWordResults();
                this.submitAll();
                break;
        }
    }

    showOverlay(subjtitle, desc, seconds) {
        const overlay = document.getElementById('overlay-waiting');
        overlay.querySelector('h1').innerText = subjtitle;
        overlay.querySelector('p').innerText = desc;
        overlay.querySelector('#countdown').innerText = seconds;
        overlay.style.display = 'flex';
    }

    startTimer(seconds, onComplete) {
        this.remainingTime = seconds;
        this.updateTimerDisplay();
        
        this.timerInterval = setInterval(() => {
            this.remainingTime--;
            this.updateTimerDisplay();
            if (document.getElementById(#overlay-countdown')) {
                document.getElementById('#overlay-countdown').innerText = this.remainingTime;
            }
            if (this.remainingTime <= 0) {
                clearInterval(this.timerInterval);
                onComplete();
            }
        }, 1000);
    }

    updateTimerDisplay() {
        const mins = Math.floor(this.remainingTime / 60).toString().padStart(2, '0');
        const secs = (this.remainingTime % 60).toString().padStart(2, '0');
        document.getElementById('exam-timer').innerText = `${mins}:${secs}`;
    }

    // ----- Preparations -----

    prepareSteno() {
        document.getElementById('steno-audio').src = stenoTestData.audioUrl;
    }

    prepareTyping() {
        document.getElementById('typing-text-container').innerHTML = typingTestData.textContent;
    }

    prepareWord() {
        document.getElementById('word-document').innerHTML = wordTestData.textContent || '<p><br></p>';
        window.currentQuestionIndex = 0;
        window.wordQuestions = wordTestData.questions || [];
        if (window.wordQuestions.length > 0) {
            showQuestion(0);
        }
    }

    // ----- Result Saving -----

    saveStenoResults() {
        const userText = document.getElementById('steno-textarea').value;
        // Simple evaluation or just save text
        this.stenoResults = {
            testId: liveExamData.stenoTestId,
            userText: userText,
            timeTaken: stenoTestData.typeDuration * 60
        };
    }

    saveTypingResults() {
        const userText = document.getElementById('typing-textarea').value;
        const originalWords = typingTestData.textContent.trim().split(/\s+/);
        const userWords = userText.trim().split(/\s+/);
        
        let correctWords = 0;
        let errors = 0;
        for (let i = 0; i < userWords.length; i++) {
            if (i < originalWords.length && userWords[i] === originalWords[i]) {
                correctWords++;
            } else {
                errors++;
            }
        }
        const wpm = (correctWords / typingTestData.typeDuration);

        this.typingResults = {
            testId: liveExamData.typingTestId,
            wpm: Math.round(wpm),
            accuracy: originalWords.length > 0 ? Math.round((correctWords / userWords.length) * 100) : 0,
            errors: errors,userText
        };
    }

    saveWordResults() {
        const docContent = document.getElementById('word-document').innerHTML;
        // Simplified eval
        this.wordResults = {
            testId: liveExamData.wordTestId,
            score: 0,
            userHTML: docContent
        };
    }

    async submitAll() {
        document.getElementById('overlay-waiting').style.display = 'flex';
        document.querySelector('#overlay-waiting h1').innerText = "Submitting Results";
        document.querySelector('#overlay-waiting p').innerText = "Please wait while your results are saved...";

        const user = firebase.auth().currentUser;
        if (user) {
            try {
                const resultDoc = {
                    userId: user.uid,
                    liveExamId: liveExamId,
                    stenoResults: this.stenoResults,
                    typingResults: this.typingResults,
                    wordResults: this.wordResults,
                    submittedAt: firebase.firestore.FieldValue.serverTimestamp()
                };
                await window.db.collection('live_exam_results').add(resultDoc);
                
                document.getElementById('overlay-waiting').style.display = 'none';
                document.getElementById('result-modal').style.display = 'flex';
            } catch(me) {
                console.error(me);
                showToast("Error saving results", "error");
            }
        } else {
            showToast("Please log in", "error");
         }
    }
}

// Audio Handlers
function handleAudioPlay() {
    if (window.examEngine.phase !== 'steno_dictation') return;
    document.getElementById('test-timer');
.}

function handleAudioEnded() {
    if (window.examEngine.phase === 'steno_dictation') {
        window.examEngine.setPhase('steno_reading');
    }
}

// Word UI Infrastructure
window.currentQuestionIndex = 0;
window.wordQuestions = [];

function showQuestion(index) {
    if (index < 0 || index >= window.wordQuestions.length) return;
    window.currentQuestionIndex = index;
    const q = window.wordQuestions[index];
    document.getElementById('current-q-num').innerText = `Question ${index + 1} of ${window.wordQuestions.length}`;
    document.getElementById('current-q-text').innerText = q.text;
    
    document.getElementById('btn-prev-q').disabled = index === 0;
    document.getElementById('btn-next-q').disabled = index === window.wordQuestions.length - 1;
}

function prevQuestion() { showQuestion(window.currentQuestionIndex - 1); }
function nextQuestion() { showQuestion(window.currentQuestionIndex + 1); }

function formatDoc(cmd, value = null) {
    document.getElementById('word-document').focus();
    document.execCommand(cmd, false, value);
}

function switchRibbonTab(tabName) {
    document.querySelectorAll('.ribbon-tab').forEach(t => {
        t.classList.remove('active');
        t.style.color = '#333';
        t.style.borderBottom = 'none';
    });
    const activeTab = document.getElementById('tab-' + tabName);
    activeTab.classList.add('active');
    activeTab.style.color = '#0078d4';
    activeTab.style.borderBottom = '2px solid #0078d4';

    document.querySelectorAll('.ribbon-panel').forEach(p => p.style.display = 'none');
    document.getElementById('ribbon-' + tabName).style.display = 'flex';
}

function insertTable() {
    document.getElementById('word-document').focus();
    const tableHTML = '<table border="1" style="width: 100%; border-collapse: collapse; margin-bottom: 10px;"><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></table><br>';
    document.execCommand('insertHTML', false, tableHTML);
}

function insertImage() {
    document.getElementById('word-document').focus();
    const imgHTML = '<img src="https://via.placeholder.com/150" alt="Placeholder" style="max-width: 100%; height: auto; margin-bottom: 10px;" /><br>';
    document.execCommand('insertHTML', false, imgHTML);
}

function getSelectedParagraph() {
    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        let node = selection.anchorNode;
        if (node.nodeType === 3) node = node.parentNode;
        while(node && node.id !== 'word-document' && node.nodeName !== 'P') {
            node = node.parentNode;
        }
        if (node && (node.nodeName === 'P' || node.id === 'word-document')) {
            return node;
        }
    }
    return null;
}

function changeMargin(side) {
    const node = getSelectedParagraph();
    if (node) {
        let current = parseInt(node.style[side]) || 0;
        node.style[side] = (current + 20) + 'px';
    }
}

function changeLineSpacing(val) {
    const node = getSelectedParagraph();
    if (node) {
        node.style.lineHeight = val;
    }
}

// Init
auth.onAuthStateChanged(user => {
    if (user) {
        window.examEngine = new LiveExamEngine();
        window.examEngine.start();
    } else {
        window.location.href = 'login.html';
    }
});
