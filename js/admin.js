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
    const modal = document.getElementById('test-modal');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
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
        language: document.getElementById('test-language').value,
        speed: document.getElementById('test-speed').value,
        totalWords: parseInt(document.getElementById('test-words').value) || 0,
        date: document.getElementById('test-date').value,
        audioDuration: document.getElementById('test-audio-dur').value,
        typeDuration: document.getElementById('test-type-dur').value,
        audioUrl: document.getElementById('test-audio-url').value,
        textContent: document.getElementById('test-text').value,
        isPremium: document.getElementById('test-premium').checked,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
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
            document.getElementById('test-language').value = data.language || 'Hindi';
            document.getElementById('test-speed').value = data.speed || '60WPM';
            document.getElementById('test-words').value = data.totalWords || '';
            document.getElementById('test-date').value = data.date || '';
            document.getElementById('test-audio-dur').value = data.audioDuration || '';
            document.getElementById('test-type-dur').value = data.typeDuration || '';
            document.getElementById('test-audio-url').value = data.audioUrl || '';
            document.getElementById('test-text').value = data.textContent || '';
            document.getElementById('test-premium').checked = !!data.isPremium;
            
            document.getElementById('test-modal-title').innerText = 'Edit Test';
            const modal = document.getElementById('test-modal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
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

