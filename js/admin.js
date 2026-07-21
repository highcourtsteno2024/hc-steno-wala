document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('main-navbar').innerHTML = createNavbar('admin');
    redirectIfNotLoggedIn();
    
    initNavbar();
    
    // Check admin role
    showLoading();
    try {
        const user = getCurrentUser();
        if (!user) return;
        
        const userDoc = await window.db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
            document.getElementById('admin-panel').style.display = 'block';
            loadDashboardStats();
            loadTests();
            loadUsers();
        } else {
            document.getElementById('access-denied').style.display = 'block';
        }
    } catch (error) {
        console.error(error);
        showToast("Error verifying admin status", "error");
    } finally {
        hideLoading();
    }
});

function showAdminSection(sectionId) {
    document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'none');
    document.getElementById(sectionId).style.display = 'block';
}

async function loadDashboardStats() {
    try {
        // Simple counts (in a real prod app, use aggregation queries or counter shards)
        const usersSnap = await window.db.collection('users').get();
        const testsSnap = await window.db.collection('tests').get();
        
        let premiumCount = 0;
        usersSnap.forEach(doc => {
            if (doc.data().isPremium) premiumCount++;
        });
        
        document.getElementById('stat-users').innerText = usersSnap.size;
        document.getElementById('stat-tests').innerText = testsSnap.size;
        document.getElementById('stat-premium').innerText = premiumCount;
    } catch (error) {
        console.error(error);
    }
}

async function loadTests() {
    try {
        const snapshot = await window.db.collection('tests').get();
        const tests = [];
        snapshot.forEach(doc => tests.push({ id: doc.id, ...doc.data() }));
        
        tests.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return timeB - timeA;
        });
        
        const tbody = document.getElementById('admin-tests-body');
        
        if (tests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No tests found</td></tr>';
            return;
        }
        
        let html = '';
        tests.forEach(t => {
            html += `
                <tr>
                    <td>${escapeHtml(t.name)}</td>
                    <td>${t.date}</td>
                    <td>${t.language}</td>
                    <td>${t.speed}</td>
                    <td>${t.isPremium ? '<span class="badge badge-premium">Yes</span>' : '<span class="badge badge-free">No</span>'}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="editTest('${t.id}')">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteTest('${t.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (error) {
        console.error(error);
        document.getElementById('admin-tests-body').innerHTML = '<tr><td colspan="6" class="text-center text-error">Error loading tests</td></tr>';
    }
    // Also load live exams
    loadLiveExams();
}

async function loadUsers() {
    try {
        const snapshot = await window.db.collection('users').orderBy('createdAt', 'desc').limit(50).get();
        const tbody = document.getElementById('admin-users-body');
        
        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const u = doc.data();
            html += `
                <tr>
                    <td>${escapeHtml(u.name)}</td>
                    <td>${u.mobile}</td>
                    <td>${u.role === 'admin' ? '<span class="badge" style="background:var(--accent)">Admin</span>' : 'Student'}</td>
                    <td>${u.isPremium ? '<span class="text-success">Premium</span>' : 'Free'}</td>
                    <td>
                        <button class="btn btn-secondary btn-sm" onclick="togglePremium('${doc.id}', ${!u.isPremium})">${u.isPremium ? 'Revoke Prem' : 'Make Prem'}</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch (error) {
        console.error(error);
        document.getElementById('admin-users-body').innerHTML = '<tr><td colspan="5" class="text-center text-error">Error loading users</td></tr>';
    }
}

async function togglePremium(userId, makePremium) {
    if (!confirm(`Are you sure you want to ${makePremium ? 'grant' : 'revoke'} premium status?`)) return;
    
    try {
        await window.db.collection('users').doc(userId).update({ isPremium: makePremium });
        showToast("User updated successfully", "success");
        loadUsers();
        loadDashboardStats();
    } catch (error) {
        console.error(error);
        showToast("Error updating user", "error");
    }
}

function openTestModal() {
    document.getElementById('test-form').reset();
    document.getElementById('test-id').value = '';
    document.getElementById('test-modal-title').innerText = 'Add New Test';
    document.getElementById('test-highlight').checked = true;
    document.getElementById('questions-container').innerHTML = ''; // Clear questions
    const modal = document.getElementById('test-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
    toggleAudioUrlField();
}

function toggleAudioUrlField() {
    const type = document.getElementById('test-type').value;
    const audioGroup = document.getElementById('audio-url-group');
    const audioInput = document.getElementById('test-audio-url');
    const speedGroup = document.getElementById('speed-group');
    const speedInput = document.getElementById('test-speed');
    const audioDurGroup = document.getElementById('audio-dur-group');
    const audioDurInput = document.getElementById('test-audio-dur');
    
    const wordQuestionsGroup = document.getElementById('word-questions-group');
    
    if (type === 'typing') {
        audioGroup.style.display = 'none';
        audioInput.removeAttribute('required');
        
        if(speedGroup) speedGroup.style.display = 'none';
        if(speedInput) speedInput.removeAttribute('required');
        
        if(audioDurGroup) audioDurGroup.style.display = 'none';
        if(audioDurInput) audioDurInput.removeAttribute('required');
        
        if(wordQuestionsGroup) wordQuestionsGroup.style.display = 'none';
    } else if (type === 'word') {
        audioGroup.style.display = 'none';
        audioInput.removeAttribute('required');
        
        if(speedGroup) speedGroup.style.display = 'none';
        if(speedInput) speedInput.removeAttribute('required');
        
        if(audioDurGroup) audioDurGroup.style.display = 'none';
        if(audioDurInput) audioDurInput.removeAttribute('required');
        
        if(wordQuestionsGroup) wordQuestionsGroup.style.display = 'block';
    } else {
        audioGroup.style.display = 'block';
        audioInput.setAttribute('required', 'true');
        
        if(speedGroup) speedGroup.style.display = 'flex';
        if(speedInput) speedInput.setAttribute('required', 'true');
        
        if(audioDurGroup) audioDurGroup.style.display = 'block';
        if(audioDurInput) audioDurInput.setAttribute('required', 'true');
        
        if(wordQuestionsGroup) wordQuestionsGroup.style.display = 'none';
    }
}

function addQuestionField(data = {}) {
    const container = document.getElementById('questions-container');
    const qCount = container.children.length + 1;
    
    const div = document.createElement('div');
    div.className = 'question-block';
    div.style.cssText = 'background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border-left: 3px solid var(--accent); position: relative;';
    
    div.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
            <strong>Question ${qCount}</strong>
            <button type="button" class="btn btn-danger btn-sm" onclick="this.parentElement.parentElement.remove()" style="padding: 2px 8px; font-size: 12px;">Delete</button>
        </div>
        <div class="form-group">
            <label>Question Text (e.g., Make paragraph 1 bold)</label>
            <input type="text" class="form-control q-text" required value="${data.text || ''}">
        </div>
        <div style="display: flex; gap: 10px;">
            <div class="form-group" style="flex: 1;">
                <label>Target Element</label>
                <select class="form-control q-target" required>
                    <option value="p:nth-of-type(1)" ${data.target === 'p:nth-of-type(1)' ? 'selected' : ''}>Paragraph 1</option>
                    <option value="p:nth-of-type(2)" ${data.target === 'p:nth-of-type(2)' ? 'selected' : ''}>Paragraph 2</option>
                    <option value="p:nth-of-type(3)" ${data.target === 'p:nth-of-type(3)' ? 'selected' : ''}>Paragraph 3</option>
                    <option value="p:nth-of-type(4)" ${data.target === 'p:nth-of-type(4)' ? 'selected' : ''}>Paragraph 4</option>
                    <option value="p:nth-of-type(5)" ${data.target === 'p:nth-of-type(5)' ? 'selected' : ''}>Paragraph 5</option>
                    <option value="h1" ${data.target === 'h1' ? 'selected' : ''}>Main Heading (h1)</option>
                    <option value="h2" ${data.target === 'h2' ? 'selected' : ''}>Sub Heading (h2)</option>
                </select>
            </div>
            <div class="form-group" style="flex: 1;">
                <label>Expected Action</label>
                <select class="form-control q-action" required>
                    <option value="bold" ${data.action === 'bold' ? 'selected' : ''}>Bold</option>
                    <option value="italic" ${data.action === 'italic' ? 'selected' : ''}>Italic</option>
                    <option value="underline" ${data.action === 'underline' ? 'selected' : ''}>Underline</option>
                    <option value="strikethrough" ${data.action === 'strikethrough' ? 'selected' : ''}>Strikethrough</option>
                    <option value="align-center" ${data.action === 'align-center' ? 'selected' : ''}>Align Center</option>
                    <option value="align-right" ${data.action === 'align-right' ? 'selected' : ''}>Align Right</option>
                    <option value="align-justify" ${data.action === 'align-justify' ? 'selected' : ''}>Align Justify</option>
                    <option value="color-red" ${data.action === 'color-red' ? 'selected' : ''}>Text Color Red</option>
                    <option value="highlight-yellow" ${data.action === 'highlight-yellow' ? 'selected' : ''}>Highlight Yellow</option>
                    <option value="font-size-large" ${data.action === 'font-size-large' ? 'selected' : ''}>Increase Font Size</option>
                    <option value="insert-table" ${data.action === 'insert-table' ? 'selected' : ''}>Insert Table (Insert Tab)</option>
                    <option value="insert-image" ${data.action === 'insert-image' ? 'selected' : ''}>Insert Image (Insert Tab)</option>
                    <option value="margin-left-increase" ${data.action === 'margin-left-increase' ? 'selected' : ''}>Increase Left Margin (Page Layout)</option>
                    <option value="margin-right-increase" ${data.action === 'margin-right-increase' ? 'selected' : ''}>Increase Right Margin (Page Layout)</option>
                    <option value="line-spacing-2" ${data.action === 'line-spacing-2' ? 'selected' : ''}>Double Line Spacing (Page Layout)</option>
                    <option value="indent-increase" ${data.action === 'indent-increase' ? 'selected' : ''}>Increase Indent (Page Layout)</option>
                </select>
            </div>
        </div>
    `;
    container.appendChild(div);
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

async function saveTest(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const origText = btn.innerText;
    btn.innerText = 'Saving...';
    btn.disabled = true;
    
    const id = document.getElementById('test-id').value;
    const testData = {
        name: document.getElementById('test-name').value,
        type: document.getElementById('test-type').value || 'steno',
        language: document.getElementById('test-language').value,
        speed: document.getElementById('test-speed').value,
        totalWords: parseInt(document.getElementById('test-words').value) || 0,
        date: document.getElementById('test-date').value,
        audioDuration: document.getElementById('test-audio-dur').value,
        typeDuration: document.getElementById('test-type-dur').value,
        audioUrl: document.getElementById('test-audio-url').value,
        textContent: document.getElementById('test-text').value,
        isPremium: document.getElementById('test-premium').checked,
        backspaceMode: document.getElementById('test-backspace').value || 'full',
        allowHighlight: document.getElementById('test-highlight').checked,
        disableNavigation: document.getElementById('test-navigation').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Extract questions if it's a word test
    if (testData.type === 'word') {
        const qBlocks = document.querySelectorAll('.question-block');
        const questions = [];
        qBlocks.forEach(block => {
            questions.push({
                text: block.querySelector('.q-text').value,
                target: block.querySelector('.q-target').value,
                action: block.querySelector('.q-action').value
            });
        });
        testData.questions = questions;
    }
    
    if (testData.type === 'typing' || testData.type === 'word') {
        testData.audioUrl = ''; // No audio for typing/word test
    }
    
    try {
        if (id) {
            await window.db.collection('tests').doc(id).update(testData);
            showToast("Test updated successfully", "success");
        } else {
            testData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await window.db.collection('tests').add(testData);
            showToast("Test added successfully", "success");
        }
        closeModal('test-modal');
        loadTests();
        loadDashboardStats();
    } catch (error) {
        console.error(error);
        showToast("Error saving test", "error");
    } finally {
        btn.innerText = origText;
        btn.disabled = false;
    }
}

async function editTest(id) {
    try {
        showLoading();
        const doc = await window.db.collection('tests').doc(id).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('test-id').value = id;
            document.getElementById('test-name').value = data.name || '';
            document.getElementById('test-type').value = data.type || 'steno';
            document.getElementById('test-language').value = data.language || 'Hindi';
            document.getElementById('test-speed').value = data.speed || '60WPM';
            document.getElementById('test-words').value = data.totalWords || '';
            document.getElementById('test-date').value = data.date || '';
            document.getElementById('test-audio-dur').value = data.audioDuration || '';
            document.getElementById('test-type-dur').value = data.typeDuration || '';
            document.getElementById('test-audio-url').value = data.audioUrl || '';
            document.getElementById('test-text').value = data.textContent || '';
            document.getElementById('test-premium').checked = data.isPremium || false;
            document.getElementById('test-backspace').value = data.backspaceMode || 'full';
            document.getElementById('test-highlight').checked = data.allowHighlight !== false; // default true
            document.getElementById('test-navigation').checked = data.disableNavigation || false;
            
            // Load word questions
            document.getElementById('questions-container').innerHTML = '';
            if (data.type === 'word' && data.questions) {
                data.questions.forEach(q => addQuestionField(q));
            }
            
            document.getElementById('test-modal-title').innerText = 'Edit Test';
            const modal = document.getElementById('test-modal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
            toggleAudioUrlField();
        }
    } catch (error) {
        console.error(error);
        showToast("Error fetching test details", "error");
    } finally {
        hideLoading();
    }
}

async function deleteTest(id) {
    if (!confirm('Are you sure you want to delete this test? This cannot be undone.')) return;
    
    try {
        await window.db.collection('tests').doc(id).delete();
        showToast("Test deleted successfully", "success");
        loadTests();
        loadDashboardStats();
    } catch (error) {
        console.error(error);
        showToast("Error deleting test", "error");
    }
}

// ── Live Exams Management ──
let allLiveExams = [];

async function loadLiveExams() {
    try {
        const snapshot = await window.db.collection('live_exams').orderBy('createdAt', 'desc').get();
        allLiveExams = [];
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            allLiveExams.push({ id: doc.id, ...data });
            const dateStr = data.createdAt && data.createdAt.toDate ? new Date(data.createdAt.toDate()).toLocaleDateString() : 'N/A';
            
            html += `
                <tr>
                    <td>${escapeHtml(data.name)}</td>
                    <td>${dateStr}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="deleteLiveExam('${doc.id}')">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        if (allLiveExams.length === 0) {
            html = '<tr><td colspan="3" class="text-center">No live exams found.</td></tr>';
        }
        document.getElementById('admin-live-exams-body').innerHTML = html;
        
        populateLiveExamDropdowns();
    } catch(e) {
        console.error(e);
    }
}

function populateLiveExamDropdowns() {
    const stenoSelect = document.getElementById('live-steno-id');
    const typingSelect = document.getElementById('live-typing-id');
    const wordSelect = document.getElementById('live-word-id');
    
    stenoSelect.innerHTML = '<option value="">-- Select Steno Test --</option>';
    typingSelect.innerHTML = '<option value="">-- Select Typing Test --</option>';
    wordSelect.innerHTML = '<option value="">-- Select Word Test --</option>';
    
    allTests.forEach(test => {
        const option = `<option value="${test.id}">${escapeHtml(test.name)}</option>`;
        if (test.type === 'steno') stenoSelect.innerHTML += option;
        if (test.type === 'typing') typingSelect.innerHTML += option;
        if (test.type === 'word') wordSelect.innerHTML += option;
    });
}

function openLiveExamModal() {
    document.getElementById('live-exam-form').reset();
    document.getElementById('live-exam-id').value = '';
    document.getElementById('live-modal-title').innerText = 'Create Live Exam';
    const modal = document.getElementById('live-exam-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

function closeLiveExamModal() {
    const modal = document.getElementById('live-exam-modal');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
}

document.getElementById('live-exam-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('live-btn-save');
    btn.innerText = 'Saving...';
    btn.disabled = true;
    
    const data = {
        name: document.getElementById('live-exam-name').value,
        stenoTestId: document.getElementById('live-steno-id').value,
        typingTestId: document.getElementById('live-typing-id').value,
        wordTestId: document.getElementById('live-word-id').value,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    try {
        await window.db.collection('live_exams').add(data);
        showToast('Live Exam created successfully', 'success');
        closeLiveExamModal();
        loadLiveExams();
    } catch(e) {
        console.error(e);
        showToast('Error saving Live Exam', 'error');
    } finally {
        btn.innerText = 'Save Live Exam';
        btn.disabled = false;
    }
});

async function deleteLiveExam(id) {
    if (!confirm('Are you sure you want to delete this Live Exam?')) return;
    try {
        await window.db.collection('live_exams').doc(id).delete();
        showToast('Deleted successfully', 'success');
        loadLiveExams();
    } catch(e) {
        console.error(e);
        showToast('Error deleting', 'error');
    }
}

function handleTextUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('test-text').value = e.target.result;
        showToast("Text file loaded successfully", "success");
    };
    reader.onerror = function() {
        showToast("Error reading text file", "error");
    };
    reader.readAsText(file);
}
