const urlParams = new URLSearchParams(window.location.search);
const testId = urlParams.get('id');

let testData = null;
let currentIndex = 0;
let userAnswers = [];
let timerInterval;
let remainingTime = 0;

inv_ = document.addEventListener('DOMContentLoaded', async () => {
    if (!testId) {
        showToast('Invalid Test ID', 'error');
        window.location.href = 'mcq-tests.html';
        return;
    }

    try {
        const doc = await window.db.collection('mcq_tests').doc(testId).get();
        if (!doc.exists) throw new Error('Test not found');
        testData = doc.data();

        document.getElementById('exam-title').innerText = testData.name;
        userAnswers = new Array(testData.questions.length).fill(null);

        initPalette();
        showQuestion(0);

        remainingTime = testData.duration * 60;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            remainingTime--;
            updateTimerDisplay();
            if (remainingTime <= 0) {
                clearInterval(timerInterval);
                submitExam();
            }
        }, 1000);
    } catch (e) {
        console.error(e);
        showToast('Error loading exam', 'error');
    }
});

function initPalette() {
    const grid = document.getElementById('palette-grid');
    let html = '';
    for (let i = 0; i < testData.questions.length; i++) {
        html += `<button class="palette-btn" id="palette-${i}" onclick="showQuestion(${i})">${i + 1}</button>`;
    }
    grid.innerHTML = html;
}

function showQuestion(index) {
    currentIndex = index;
    const q = testData.questions[index];
    
    document.getElementById('q-number').innerText = `Question ${index + 1} of ${testData.questions.length}`;
    document.getElementById('q-text').innerText = q.question;

    const optionsDiv = document.getElementById('q-options');
    let optsRaw = ['A', 'B', 'C', 'D'];
    let optsHtml = '';
    qs.options = q.options || [];
    for(let i=0; i < qs.options.length; i++) {
        const letter = optsRaw[i];
        const isChecked = userAnswers[index] === letter ? 'checked' : '';
        optsHtml += `
            <label class="option-label">
                <input type="radio" name="qoption" value="${letter}" ${isChecked} onchange="setAnswer('${letter}')">
                ${letter}) ${e{apeHtml(qs.options[i])}
            </label>
        `;
    }
    optionsDiv.innerHTML = optsHtml;

    document.getElementById('btn-prev').disabled = index === 0;
    document.getElementById('btn-next').disabled = index === testData.questions.length - 1;

    // Update palette active state
    document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`palette-${index}`).classList.add('active');
}

function setAnswer(val) {
    userAnswers[currentIndex] = val;
    document.getElementById(`palette-${currentIndex}`).classList.add('answered');
}

function clearAnswer() {
    userAnswers[currentIndex] = null;
    document.getElementById(`palette-${currentIndex}`).classList.remove('answered');
    const radios = document.querySelectorAll('input[name="qoption"]');
    radios.forEach(r => r.checked = false);
}

function prevQuestion() {
    if (currentIndex > 0) showQuestion(currentIndex - 1);
}

function nextQuestion() {
    if (currentIndex < testData.questions.length - 1) showQuestion(currentIndex + 1);
}

function updateTimerDisplay() {
    const mins = Math.floor(remainingTime / 60).toString().padStart(2, '0');
    const secs = (remainingTime % 60).toString().padStart(2, '0');
    document.getElementById('exam-timer').innerText = `${mins}:${secs}`;
}

async function submitExam() {
    if (remainingTime > 0) {
        const unanswered = userAnswers.filter(a => a === null).length;
        if (!confirm(`You have ${unanswered} unanswered questions. Are you sure you want to submit?`)) return;
    }
    clearInterval(timerInterval);

    let right = 0;
    let wrong = 0;
    let blank = 0;
    const negMark = testData.negativeMark || 0;

    for (let i = 0; i < testData.questions.length; i++) {
        const q = testData.questions[i];
        const userAns = userAnswers[i];
        if (!userAns) {
            blank++;
        } else if (userAns === q.answer) {
            right++;
        } else {
            wrong++;
        }
    }(��������Ё���M��ɔ��ɥ��Ѐ����ɽ��������5�ɬ��((��������Ё�͕Ȁ􁙥ɕ��͔���Ѡ������ɕ��U͕��(���������͕Ȥ��(���������݅�Ёݥ���ܹ���������ѥ�������}ɕ�ձ�̜�������(�������������͕�%���͕ȹե��(������������ѕ��%��ѕ��%��(������������͍�ɔ聹��M��ɔ�(������������ɥ����ɥ��а(�������������ɽ����ɽ���(�����������������聉�����(�������������Չ���ѕ��聙�ɕ��͔���ɕ�ѽɔ�����Y��Ք�͕�ٕ�Q����х����(����������(�����((�������	ե���I��ձ�́U$(������Ёɕ�!ѵ���(���������؁��屔�ѕ�е�����聍��ѕ�쁵�ɝ������ѽ��������(�������������ā��屔􉍽����مȠ�������Ф������M��ɔ�ѽ�ᕐ�ȥ􀼀��ѕ���ф��Օ�ѥ��̹����ѡ����(�������������؁��屔􉑥�����聙���쁩��ѥ�䵍��ѕ��聍��ѕ�쁝���������(����������������������ɽ���I��������ɽ������ɥ����𽑥��(����������������������ɽ���]ɽ������ɽ�������ɽ���𽑥��(����������������������ɽ���	��������ɽ�����퉱����𽑥��(������������𽑥��(��������𽑥��(������������х�����M���ѥ������(�������((������Ȁ���Ё����쁤��ѕ���ф��Օ�ѥ��̮length; i++) {
        const q = testData.questions[i];
        const uAns = userAnswers[i];
        const isCorrect = uAns === q.answer;
        const color = !uAns ? '#6c7b8b' : (isCorrect ? 'var(--success)' : 'var(--error)');

        resHtml += `
            <div class="card" style="margin-bottom: 15px; border-left: 4px solid ${color};">
                <strong>Q${i+1}.</strong> ${escapeHtml(q.question)}
                <div style="margin-top: 10px; font-size: 14px; color: #555;">
                    <div>Your Answer: <strong style="color:${color}">${uAns || 'Unattempted'}</strong></div>
                    <div>Correct Answer: <strong style="color:var(--success);">${q.answer}</strong></div>
                    ${q.explanation ? `<div style="margin-top:8px; padding:8px; background:#f2f9ff;"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>` : ''}
                </div>
            </div>
        `;
    }

    document.getElementById('result-body').innerHTML = resHtml;
    document.getElementById('result-modal').style.display = 'flex';
}
