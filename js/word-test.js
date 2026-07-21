let testData = null;
let timerInterval = null;
let timeLeft = 0;
let totalTime = 0;
let isTestRunning = false;
let currentQuestionIndex = 0;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('main-navbar').innerHTML = createNavbar('word');
    redirectIfNotLoggedIn();
    
    initNavbar();
    
    const urlParams = new URLSearchParams(window.location.search);
    const testId = urlParams.get('id');
    
    if (!testId) {
        window.location.href = 'word-tests.html';
        return;
    }
    
    await loadTestData(testId);
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
        
        // Parse time limits (e.g. "10Mins" or "10")
        const durMatch = (testData.typeDuration || "10").match(/\d+/);
        totalTime = (durMatch ? parseInt(durMatch[0]) : 10) * 60;
        timeLeft = totalTime;
        updateTimerDisplay();
        
        const docHtml = (testData.textContent || "")
            .split('\n')
            .filter(p => p.trim() !== '')
            .map(p => `<p>${escapeHtml(p)}</p>`)
            .join('');
            
        const docEl = document.getElementById('word-document');
        docEl.innerHTML = docHtml;
        
        if (testData.language !== 'English') {
            docEl.style.fontFamily = "'Kruti Dev 010', Arial, sans-serif";
        } else {
            docEl.style.fontFamily = "Arial, sans-serif";
        }
        
    } catch (error) {
        console.error("Load test data error details:", error);
        showToast("Error: " + error.message, "error");
        document.getElementById('test-title').innerText = "Error: " + error.message;
    } finally {
        hideLoading();
    }
}

function updateTimerDisplay() {
    const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const sec = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('time-display').innerText = `${min}:${sec}`;
}

function startTestEngine() {
    if (isTestRunning) return;
    isTestRunning = true;
    
    document.getElementById('btn-start').style.display = 'none';
    document.getElementById('btn-submit').style.display = 'inline-block';
    
    document.getElementById('word-ui').style.display = 'block';
    
    if (testData.questions && testData.questions.length > 0) {
        document.getElementById('questions-bar').style.display = 'block';
        showQuestion(0);
    }
    
    const docEl = document.getElementById('word-document');
    docEl.contentEditable = "true";
    docEl.focus();
    
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            autoSubmit();
        }
    }, 1000);
}

function showQuestion(index) {
    if (!testData.questions || testData.questions.length === 0) return;
    
    currentQuestionIndex = index;
    const q = testData.questions[index];
    
    document.getElementById('current-q-num').innerText = `Question ${index + 1} of ${testData.questions.length}`;
    document.getElementById('current-q-text').innerText = q.text;
    
    document.getElementById('btn-prev-q').disabled = (index === 0);
    document.getElementById('btn-next-q').disabled = (index === testData.questions.length - 1);
}

function prevQuestion() {
    if (currentQuestionIndex > 0) showQuestion(currentQuestionIndex - 1);
}

function nextQuestion() {
    if (currentQuestionIndex < testData.questions.length - 1) showQuestion(currentQuestionIndex + 1);
}

function formatDoc(cmd, value = null) {
    if (!isTestRunning) return;
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
    if (!isTestRunning) return;
    document.getElementById('word-document').focus();
    const tableHTML = '<table border="1" style="width: 100%; border-collapse: collapse; margin-bottom: 10px;"><tr><td>Cell 1</td><td>Cell 2</td></tr><tr><td>Cell 3</td><td>Cell 4</td></tr></table><br>';
    document.execCommand('insertHTML', false, tableHTML);
}

function insertImage() {
    if (!isTestRunning) return;
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
    if (!isTestRunning) return;
    const node = getSelectedParagraph();
    if (node) {
        let current = parseInt(node.style[side]) || 0;
        node.style[side] = (current + 20) + 'px';
    }
}

function changeLineSpacing(val) {
    if (!isTestRunning) return;
    const node = getSelectedParagraph();
    if (node) {
        node.style.lineHeight = val;
    }
}

async function autoSubmit() {
    showToast("Time's up! Auto-submitting...", "info");
    await submitTest();
}

async function submitTest() {
    if (timerInterval) clearInterval(timerInterval);
    isTestRunning = false;
    document.getElementById('word-document').contentEditable = "false";
    
    showLoading();
    
    try {
        const user = getCurrentUser();
        const docEl = document.getElementById('word-document');
        const finalHtml = docEl.innerHTML;
        
        let correctAnswers = 0;
        let totalQuestions = 0;
        let evaluationDetails = [];
        
        if (testData.questions && testData.questions.length > 0) {
            totalQuestions = testData.questions.length;
            
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = finalHtml;
            
            testData.questions.forEach((q, idx) => {
                let isCorrect = false;
                try {
                    const targetEl = tempDiv.querySelector(q.target);
                    if (targetEl) {
                        const style = window.getComputedStyle(targetEl);
                        const inlineStyle = targetEl.style;
                        
                        if (q.action === 'bold') {
                            isCorrect = targetEl.querySelector('b, strong') !== null || inlineStyle.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700;
                        } else if (q.action === 'italic') {
                            isCorrect = targetEl.querySelector('i, em') !== null || inlineStyle.fontStyle === 'italic';
                        } else if (q.action === 'underline') {
                            isCorrect = targetEl.querySelector('u') !== null || inlineStyle.textDecoration.includes('underline');
                        } else if (q.action === 'strikethrough') {
                            isCorrect = targetEl.querySelector('s, strike') !== null || inlineStyle.textDecoration.includes('line-through');
                        } else if (q.action === 'align-center') {
                            isCorrect = inlineStyle.textAlign === 'center' || targetEl.getAttribute('align') === 'center';
                        } else if (q.action === 'align-right') {
                            isCorrect = inlineStyle.textAlign === 'right' || targetEl.getAttribute('align') === 'right';
                        } else if (q.action === 'align-justify') {
                            isCorrect = inlineStyle.textAlign === 'justify' || targetEl.getAttribute('align') === 'justify';
                        } else if (q.action === 'color-red') {
                            isCorrect = !!targetEl.querySelector('font[color="#ff0000"]') || !!targetEl.querySelector('[style*="color: rgb(255, 0, 0)"]');
                        } else if (q.action === 'highlight-yellow') {
                            isCorrect = !!targetEl.querySelector('[style*="background-color: rgb(255, 255, 0)"]');
                        } else if (q.action === 'font-size-large') {
                            isCorrect = !!targetEl.querySelector('font[size="4"]') || !!targetEl.querySelector('font[size="5"]');
                        } else if (q.action === 'insert-table') {
                            isCorrect = !!targetEl.querySelector('table');
                        } else if (q.action === 'insert-image') {
                            isCorrect = !!targetEl.querySelector('img');
                        } else if (q.action === 'margin-left-increase') {
                            isCorrect = parseInt(inlineStyle.marginLeft) > 0 || parseInt(style.marginLeft) > 0;
                        } else if (q.action === 'margin-right-increase') {
                            isCorrect = parseInt(inlineStyle.marginRight) > 0 || parseInt(style.marginRight) > 0;
                        } else if (q.action === 'line-spacing-2') {
                            isCorrect = inlineStyle.lineHeight === '2' || inlineStyle.lineHeight === '200%' || style.lineHeight === '2';
                        } else if (q.action === 'indent-increase') {
                            isCorrect = targetEl.querySelector('blockquote') !== null || targetEl.closest('blockquote') !== null;
                        }
                    }
                } catch (e) {
                    console.error("Error evaluating question", idx, e);
                }
                
                if (isCorrect) correctAnswers++;
                evaluationDetails.push({ question: q.text, correct: isCorrect });
            });
        }
        
        let marks = 0;
        if (totalQuestions > 0) {
            marks = (correctAnswers * 100) / totalQuestions;
        } else {
            marks = 100;
        }
        
        const resultData = {
            userId: user.uid,
            testId: testData.id,
            testName: testData.name,
            type: 'word',
            marks: parseFloat(marks.toFixed(2)),
            totalQuestions: totalQuestions,
            correctAnswers: correctAnswers,
            finalHtml: finalHtml,
            evaluationDetails: evaluationDetails,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await window.db.collection('results').add(resultData);
        
        document.getElementById('res-marks').innerText = `${Math.round(marks)} / 100`;
        
        hideLoading();
        const modal = document.getElementById('result-modal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
    } catch (error) {
        console.error(error);
        showToast("Error submitting test", "error");
        hideLoading();
    }
}

function goToScorecard() {
    window.location.href = 'scorecard.html';
}

window.addEventListener('beforeunload', (e) => {
    if (isTestRunning) {
        e.preventDefault();
        e.returnValue = '';
    }
});
