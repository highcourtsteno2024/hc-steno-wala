document.addEventListener('DOMContentLoaded', () => {
    initNavbar('live-exams');
    loadLiveExams();
});

async function loadLiveExams() {
    const grid = document.getElementById('test-grid');
    try {
        const snapshot = await window.db.collection('live_exams').orderBy('createdAt', 'desc').get();
        
        if (snapshot.empty) {
            grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px;"><p>No live exams available at the moment.</p></div>';
            return;
        }

        let html = '';
        snapshot.forEach(doc => {
            const exam = doc.data();
            const dateStr = exam.createdAt && exam.createdAt.toDate ? new Date(exam.createdAt.toDate()).toLocaleDateString() : 'N/A';
            
            html += `
                <div class="test-card">
                    <div class="test-type-badge">LIVE EXAM BUNDLE</div>
                    <div class="test-card-title">${escapeHtml(exam.name)}</div>
                    <div class="test-card-details">
                        <div class="detail-item"><span>📅 Created:</span> <span>${dateStr}</span></div>
                        <div class="detail-item"><span>📚 Phases:</span> <span>3 (Steno, Typing, Word)</span></div>
                    </div>
                    <div class="test-card-actions">
                        <a href="live-exam.html?id=${doc.id}" class="btn btn-primary" style="width: 100%;">Take Live Exam</a>
                    </div>
                </div>
            `;
        });
        
        grid.innerHTML = html;
    } catch (e) {
        console.error(e);
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--error); padding: 40px;">Failed to load live exams.</div>';
    }
}
