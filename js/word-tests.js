let allTests = [];
let filteredTests = [];
let userAttemptedTestIds = new Set();
let currentPage = 1;
const itemsPerPage = 20;

document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('main-navbar').innerHTML = createNavbar('word');
    redirectIfNotLoggedIn();
    
    initNavbar();
    
    const user = getCurrentUser();
    if (user) {
        await fetchAttempted(user.uid);
        await fetchTests();
    }
});

async function fetchAttempted(userId) {
    try {
        const resultsSnap = await window.db.collection('results').where('userId', '==', userId).get();
        resultsSnap.forEach(doc => {
            userAttemptedTestIds.add(doc.data().testId);
        });
    } catch (e) {
        console.error("Error fetching attempted tests", e);
    }
}

async function fetchTests() {
    try {
        const snapshot = await window.db.collection('tests').get();
        allTests = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.type === 'word') {
                allTests.push({ id: doc.id, ...data });
            }
        });
        
        allTests.sort((a, b) => {
            const timeA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
            const timeB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
            return timeB - timeA;
        });
        
        filteredTests = [...allTests];
        renderTests();
    } catch (error) {
        console.error(error);
        document.getElementById('tests-table-body').innerHTML = '<tr><td colspan="9" class="text-center text-error">Failed to load tests.</td></tr>';
    }
}

const debounceFilter = debounce(() => { filterTests(); }, 300);

function filterTests() {
    const speed = document.getElementById('filter-speed').value;
    const search = document.getElementById('search-test').value.toLowerCase();
    
    filteredTests = allTests.filter(t => {
        let matchSpeed = speed === 'All' || t.speed === speed;
        let matchSearch = !search || (t.name && t.name.toLowerCase().includes(search));
        return matchSpeed && matchSearch;
    });
    
    currentPage = 1;
    renderTests();
}

function renderTests() {
    const tbody = document.getElementById('tests-table-body');
    if (filteredTests.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">No tests found matching criteria.</td></tr>';
        document.getElementById('btn-prev').disabled = true;
        document.getElementById('btn-next').disabled = true;
        document.getElementById('page-info').innerText = 'Page 1 of 1';
        return;
    }
    
    const totalPages = Math.ceil(filteredTests.length / itemsPerPage);
    document.getElementById('page-info').innerText = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('btn-prev').disabled = currentPage === 1;
    document.getElementById('btn-next').disabled = currentPage === totalPages;
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageTests = filteredTests.slice(start, end);
    
    let html = '';
    pageTests.forEach((t, index) => {
        const isAttempted = userAttemptedTestIds.has(t.id);
        const premiumBadge = t.isPremium ? '<span title="Premium Test">🔒</span> ' : '';
        
        let actionButtons = '';
        if (isAttempted) {
            actionButtons = `
                <button class="btn btn-secondary btn-sm" onclick="window.location.href='scorecard.html'">📋 Answer Sheet</button>
                <button class="btn btn-primary btn-sm" style="background:var(--success)" onclick="startTest('${t.id}', ${t.isPremium})">🔄 Re Start</button>
            `;
        } else {
            actionButtons = `<button class="btn btn-primary btn-sm" style="background:var(--success)" onclick="startTest('${t.id}', ${t.isPremium})">▶ Start Test</button>`;
        }
        
        html += `
            <tr>
                <td>${start + index + 1}</td>
                <td>${t.date || '-'}</td>
                <td>${t.language || 'Hindi'}</td>
                <td>${premiumBadge}${escapeHtml(t.name || 'Untitled Test')}</td>
                <td>${t.speed || '-'}</td>
                <td>${t.totalWords || '-'}</td>
                <td>${t.audioDuration || '-'}</td>
                <td>${t.typeDuration || '-'}</td>
                <td style="display:flex; gap:5px;">${actionButtons}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

function changePage(delta) {
    currentPage += delta;
    renderTests();
}

async function startTest(testId, isPremium) {
    if (isPremium) {
        // check if user is premium
        const user = getCurrentUser();
        try {
            const userDoc = await window.db.collection('users').doc(user.uid).get();
            if (!userDoc.exists || !userDoc.data().isPremium) {
                if (userDoc.data().role !== 'admin') {
                    showToast("This is a Premium Test. Please upgrade your account.", "warning");
                    return;
                }
            }
        } catch (e) {
            console.error(e);
            return;
        }
    }
    
    window.location.href = `word-test.html?id=${testId}`;
}
