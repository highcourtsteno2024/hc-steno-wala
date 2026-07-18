document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-navbar').innerHTML = createNavbar('scorecard');
    redirectIfNotLoggedIn();
    
    const user = getCurrentUser();
    if (!user) return;
    
    initNavbar();
    loadResults(user.uid);
});

let userResults = [];

async function loadResults(userId) {
    try {
        const resultsRef = window.db.collection('results').where('userId', '==', userId);
        const snapshot = await resultsRef.get();
        
        userResults = [];
        snapshot.forEach(doc => {
            userResults.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort in memory to avoid composite index requirement
        userResults.sort((a, b) => {
            const timeA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const timeB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return timeB - timeA;
        });
        
        renderResults();
        renderSummary();
    } catch (error) {
        console.error("Error loading results:", error);
        showToast("परिणाम लोड करने में त्रुटि", "error");
        document.getElementById('results-table-body').innerHTML = '<tr><td colspan="9" class="text-center">Error loading results. Please try again later.</td></tr>';
    }
}

function renderSummary() {
    const totalTests = userResults.length;
    let avgScore = 0;
    let bestScore = 0;
    
    if (totalTests > 0) {
        const totalMarks = userResults.reduce((acc, curr) => acc + (curr.marks || 0), 0);
        avgScore = (totalMarks / totalTests).toFixed(2);
        bestScore = Math.max(...userResults.map(r => r.marks || 0)).toFixed(2);
    }
    
    const summaryHtml = `
        <div class="card" style="border-left: 4px solid var(--primary-light)"><div class="stat-value">${totalTests}</div><div class="stat-label">Total Tests</div></div>
        <div class="card" style="border-left: 4px solid var(--accent)"><div class="stat-value">${avgScore}%</div><div class="stat-label">Average Score</div></div>
        <div class="card" style="border-left: 4px solid var(--success)"><div class="stat-value">${bestScore}%</div><div class="stat-label">Best Score</div></div>
    `;
    
    document.getElementById('performance-summary').innerHTML = summaryHtml;
}

function renderResults() {
    const tbody = document.getElementById('results-table-body');
    if (userResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">आपने अभी तक कोई टेस्ट नहीं दिया है।</td></tr>';
        return;
    }
    
    let html = '';
    userResults.forEach((res, index) => {
        const dateStr = formatDate(new Date(res.timestamp?.toDate ? res.timestamp.toDate() : res.timestamp));
        const marks = res.marks ? res.marks.toFixed(2) : '0.00';
        const colorClass = res.marks >= 80 ? 'text-success' : (res.marks < 50 ? 'text-error' : '');
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${dateStr}</td>
                <td>${escapeHtml(res.testName || 'Unknown')}</td>
                <td>${res.totalWords || 0}</td>
                <td>${res.totalTyped || 0}</td>
                <td>${res.incorrect || 0}</td>
                <td class="${colorClass} font-bold">${marks}%</td>
                <td>${res.rank || '-'}</td>
                <td>
                    <button class="btn btn-secondary btn-sm" onclick="compareText('${res.id}')">📄 Show</button>
                    <button class="btn btn-success btn-sm" onclick="showRank('${res.id}')">🏆 Rank</button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
}

async function compareText(resultId) {
    const result = userResults.find(r => r.id === resultId);
    if (!result) return;
    
    showLoading();
    try {
        const testDoc = await window.db.collection('tests').doc(result.testId).get();
        if (testDoc.exists) {
            const testData = testDoc.data();
            const originalWords = (testData.textContent || "").split(/\s+/).filter(w => w.trim() !== '');
            const typedWords = (result.typedText || "").split(/\s+/).filter(w => w.trim() !== '');
            
            let compareHtml = '';
            for (let i = 0; i < Math.max(originalWords.length, typedWords.length); i++) {
                const orig = originalWords[i] || '';
                const typed = typedWords[i] || '';
                
                if (orig === typed) {
                    compareHtml += `<span style="color: var(--success);">${escapeHtml(typed)}</span> `;
                } else if (!typed) {
                    compareHtml += `<span style="color: var(--warning); text-decoration: line-through;">${escapeHtml(orig)}</span> `;
                } else if (!orig) {
                    compareHtml += `<span style="color: var(--error);">${escapeHtml(typed)}</span> `;
                } else {
                    compareHtml += `<span style="color: var(--error);" title="Correct: ${escapeHtml(orig)}">${escapeHtml(typed)}</span> `;
                }
            }
            
            document.getElementById('compare-display').innerHTML = compareHtml;
            const modal = document.getElementById('compare-modal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        } else {
            showToast("टेस्ट डेटा उपलब्ध नहीं है।", "warning");
        }
    } catch (error) {
        console.error(error);
        showToast("त्रुटि", "error");
    } finally {
        hideLoading();
    }
}

async function showRank(resultId) {
    const result = userResults.find(r => r.id === resultId);
    if (!result) return;
    
    showLoading();
    try {
        const snapshot = await window.db.collection('test_results')
            .where('testId', '==', result.testId)
            .get();
            
        let allResults = [];
        snapshot.forEach(doc => allResults.push(doc.data()));
        
        if (allResults.length === 0) {
            showToast("No rank data available yet.", "info");
            return;
        }
        
        // Sort by marks descending, then by words typed descending
        allResults.sort((a, b) => {
            if (b.marks !== a.marks) return b.marks - a.marks;
            return b.totalTyped - a.totalTyped;
        });
        
        let rank = -1;
        for (let i = 0; i < allResults.length; i++) {
            // Find the current user's entry (could have multiple attempts, so match exact marks/time roughly or just the highest)
            // But since we are looking for THIS specific result, we can match user ID and marks
            if (allResults[i].userId === result.userId && allResults[i].marks === result.marks) {
                rank = i + 1;
                break;
            }
        }
        
        if (rank === -1) rank = "N/A"; // Shouldn't happen
        
        document.getElementById('rank-display').innerText = `#${rank}`;
        document.getElementById('rank-subtext').innerText = `Out of ${allResults.length} total attempts for this test.`;
        
        const modal = document.getElementById('rank-modal');
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
        
    } catch (error) {
        console.error("Error fetching rank:", error);
        showToast("Error loading rank", "error");
    } finally {
        hideLoading();
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}
