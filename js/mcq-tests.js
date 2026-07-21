const categories = [
    { id: 'Raj LDC', name: 'Raj LDC', icon: '🏛️', color: '#3b82f6' },
    { id: 'Raj HC LDC', name: 'Raj HC LDC', icon: '⚖️', color: '#10b981' },
    { id: 'Raj 4th Grade', name: 'Raj 4th Grade', icon: '📝', color: '#8b5cf6' },
    { id: 'RAS', name: 'RAS', icon: '🎓', color: '#ef4444' },
    { id: '1st Grade', name: '1st Grade', icon: '👨‍🏫', color: '#f59e0b' },
    { id: '2nd Grade', name: '2nd Grade', icon: '👩‍🏫', color: '#0ea5e9' },
    { id: 'VDO', name: 'VDO', icon: '🏘️', color: '#14b8a6' },
    { id: 'Lab Assistant', name: 'Lab Assistant', icon: '🔬', color: '#ec4899' },
    { id: 'Other', name: 'Other / Miscellaneous', icon: '📚', color: '#64748b' }
];

let allTests = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavbar('mcq');
    showCategories();
    
    document.getElementById('search-tests')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.test-card').forEach(card => {
            const title = card.querySelector('.test-card-title').innerText.toLowerCase();
            card.style.display = title.includes(term) ? 'flex' : 'none';
        });
    });
});

function showCategories() {
    document.getElementById('breadcrumb').style.display = 'none';
    document.getElementById('search-container').style.display = 'none';
    document.getElementById('page-main-title').innerText = 'MCQ Categories';
    
    const grid = document.getElementById('test-grid');
    let html = '';
    
    categories.forEach(cat => {
        html += `
            <div class="test-card" style="cursor: pointer; text-align: center; border-top: 4px solid ${cat.color}; padding: 30px 20px;" onclick="loadTestsForCategory('${cat.id}')">
                <div style="font-size: 3rem; margin-bottom: 15px;">${cat.icon}</div>
                <div class="test-card-title" style="font-size: 1.3rem;">${cat.name}</div>
                <div style="color: var(--text-muted); margin-top: 10px; font-size: 0.9rem;">Click to view tests</div>
            </div>
        `;
    });
    
    grid.innerHTML = html;
}

async function fetchAllTests() {
    if (allTests.length > 0) return allTests; // Use cache if available
    
    try {
        const snapshot = await window.db.collection('mcq_tests').orderBy('createdAt', 'desc').get();
        const tests = [];
        snapshot.forEach(doc => {
            tests.push({ id: doc.id, ...doc.data() });
        });
        allTests = tests;
        return tests;
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function loadTestsForCategory(categoryId) {
    document.getElementById('breadcrumb').style.display = 'block';
    document.getElementById('search-container').style.display = 'block';
    
    const catObj = categories.find(c => c.id === categoryId) || { name: categoryId, color: 'var(--primary)' };
    document.getElementById('page-main-title').innerText = `${catObj.name} Tests`;
    
    const grid = document.getElementById('test-grid');
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><div class="loading-spinner"></div><p>Loading tests...</p></div>';
    
    const tests = await fetchAllTests();
    
    if (!tests) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--error); padding: 40px;">Failed to load tests.</div>';
        return;
    }
    
    // Filter tests by category
    const categoryTests = tests.filter(test => {
        // Handle tests that were uploaded before category was mandatory
        const testCat = test.category || 'Other';
        return testCat === categoryId;
    });
    
    if (categoryTests.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><p>No tests available for this category yet.</p></div>';
        return;
    }

    let html = '';
    categoryTests.forEach(test => {
        const dateStr = test.createdAt && test.createdAt.toDate ? new Date(test.createdAt.toDate()).toLocaleDateString() : 'N/A';
        const qCount = test.questions ? test.questions.length : 0;
        
        html += `
            <div class="test-card">
                <div class="test-type-badge" style="background: ${catObj.color};">${catObj.name}</div>
                <div class="test-card-title">${escapeHtml(test.name)}</div>
                <div class="test-card-details">
                    <div class="detail-item"><span>📅 Added:</span> <span>${dateStr}</span></div>
                    <div class="detail-item"><span>⏰ Duration:</span> <span>${test.duration} Mins</span></div>
                    <div class="detail-item"><span>📝 Questions:</span> <span>${qCount}</span></div>
                </div>
                <div class="test-card-actions">
                    <a href="take-mcq.html?id=${test.id}" class="btn btn-primary" style="width: 100%;">Start Test</a>
                </div>
            </div>
        `;
    });
    grid.innerHTML = html;
}
