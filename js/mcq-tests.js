document.addEventListener('DOMContentLoaded', () => {
    initNavbar('mcq');
    loadMCQTests();
    
    document.getElementById('search-tests')?.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('.test-card').forEach(card => {
            const title = card.querySelector('.test-card-title').innerText.toLowerCase();
            card.style.display = title.includes(term) ? 'flex' : 'none';
        });
    });
});

async function loadMCQTests() {
    const grid = document.getElementById('test-grid');
    try {
        const snapshot = await window.db.collection('mcq_tests').orderBy('createdAt', 'desc').get();
        if (snapshot.empty) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><p>No MCQ tests available.</p></div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const test = doc.data();
            const dateStr = test.createdAt && test.createdAt.toDate ? new Date(test.createdAt.toDate()).toLocaleDateString() : 'N/A';
            const qCount = test.questions ? test.questions.length : 0;
            
            html += `
                <div class="test-card">
                    <div class="test-type-badge" style="background: var(--accent);">MCQ TEST</div>
                    <div class="test-card-title">${escapeHtml(test.name)}</div>
                    <div class="test-card-details">
                        <div class="detail-item"><span>𝓅 Added:</span> <span>${dateStr}</span></div>
                        <div class="detail-item"><span>⏰ Duration:</span> <span>${test.duration} Mins</span></div>
                        <div class="detail-item"><span>𝓝 Questions:</span> <span>${qCount}</span></div>
                    </div>
                    <div class="test-card-actions">
                        <a href="take-mcq.html?id=${doc.id}" class="btn btn-primary" style="width: 100%;">Start Test</a>
                    </div>
                </div>
            `;
        });
        grid.innerHTML = html;
    } catch(e) {
        console.error(e);
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--error); padding: 40px;">Failed to load tests.</div>';
    }
}
