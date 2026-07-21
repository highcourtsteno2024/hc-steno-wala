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
    const filterType = document.getElementById('filter-type') ? document.getElementById('filter-type').value : 'all';
    const filteredResults = filterType === 'all' ? userResults : userResults.filter(r => (r.type || 'steno') === filterType);
    
    const totalTests = filteredResults.length;
    let avgScore = 0;
    let bestScore = 0;
    
    if (totalTests > 0) {
        const totalMarks = filteredResults.reduce((acc, curr) => acc + (curr.marks || 0), 0);
        avgScore = (totalMarks / totalTests).toFixed(2);
        bestScore = Math.max(...filteredResults.map(r => r.marks || 0)).toFixed(2);
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
    const filterType = document.getElementById('filter-type') ? document.getElementById('filter-type').value : 'all';
    
    const filteredResults = filterType === 'all' ? userResults : userResults.filter(r => (r.type || 'steno') === filterType);
    
    // Also update summary when rendering results
    renderSummary();
    
    const thead = document.querySelector('.data-table thead tr');
    if (thead) {
        if (filterType === 'word') {
            thead.innerHTML = `
                <th>S.No.</th>
                <th>Date</th>
                <th>Test Name</th>
                <th>Total Qs</th>
                <th>Wrong Qs</th>
                <th>-</th>
                <th>-</th>
                <th>Marks (%)</th>
                <th>Rank</th>
                <th>Actions</th>
            `;
        } else {
            thead.innerHTML = `
                <th>S.No.</th>
                <th>Date</th>
                <th>Test Name</th>
                <th>Total Words</th>
                <th>Full Mistakes</th>
                <th>Half Mistakes</th>
                <th>Speed (WPM)</th>
                <th>Marks (%)</th>
                <th>Rank</th>
                <th>Actions</th>
            `;
        }
    }
    
    if (filteredResults.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="text-center">कोई डेटा उपलब्ध नहीं है।</td></tr>';
        return;
    }
    
    let html = '';
    filteredResults.forEach((res, index) => {
        const dateStr = formatDate(new Date(res.timestamp?.toDate ? res.timestamp.toDate() : res.timestamp));
        const marks = res.marks ? res.marks.toFixed(2) : '0.00';
        const colorClass = res.marks >= 80 ? 'text-success' : (res.marks < 50 ? 'text-error' : '');
        
        let rowDetails = '';
        if (res.type === 'word') {
            rowDetails = `
                <td>${res.totalQuestions || 0} Qs</td>
                <td>${(res.totalQuestions || 0) - (res.correctAnswers || 0)} (Wrong)</td>
                <td>-</td>
                <td>-</td>
            `;
        } else {
            rowDetails = `
                <td>${res.totalWords || 0}</td>
                <td>${res.fullMistakes !== undefined ? res.fullMistakes : res.incorrect || 0}</td>
                <td>${res.halfMistakes || 0}</td>
                <td>${res.speedWPM || 0} WPM</td>
            `;
        }
        
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${dateStr}</td>
                <td>${escapeHtml(res.testName || 'Unknown')} <span style="font-size:10px; color:var(--accent);">(${res.type === 'word' ? 'Word' : 'Steno/Typing'})</span></td>
                ${rowDetails}
                <td class="${colorClass} font-bold">${marks}%</td>
                <td>${res.rank || '-'}</td>
                <td>
                    ${res.type === 'word' 
                        ? `<button class="btn btn-outline btn-sm" onclick="compareText('${res.id}')">📄 View Result</button>`
                        : `<button class="btn btn-secondary btn-sm" onclick="compareText('${res.id}')">📄 Show</button>
                           <button class="btn btn-success btn-sm" onclick="showRank('${res.id}')">🏆 Rank</button>`
                    }
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
            const compareDisplay = document.getElementById('compare-display');
            
            if (result.type === 'word') {
                compareDisplay.classList.remove('krutidev-text');
                let detailsHtml = '<h4 style="margin-bottom: 15px; font-family: Arial;">Word Efficiency Evaluation:</h4><ul style="text-align: left; list-style: none; padding: 0; font-family: Arial;">';
                if (result.evaluationDetails && result.evaluationDetails.length > 0) {
                    result.evaluationDetails.forEach(q => {
                        const color = q.correct ? 'var(--success)' : 'var(--error)';
                        const icon = q.correct ? '✅' : '❌';
                        detailsHtml += `<li style="margin-bottom: 12px; font-size: 16px;"><span style="color: ${color}; font-weight: bold;">${icon}</span> ${escapeHtml(q.question)}</li>`;
                    });
                } else {
                    detailsHtml += '<li>No details available (Auto scored 100%)</li>';
                }
                detailsHtml += '</ul>';
                
                detailsHtml += '<h4 style="margin-top: 20px; border-top: 1px solid var(--border); padding-top: 15px;">Your Final Document:</h4>';
                detailsHtml += `<div style="background: white; color: black; padding: 20px; border: 1px solid #ccc; font-family: ${testData && testData.language !== 'English' ? "'Kruti Dev 010', Arial" : "Arial"}; text-align: left;">${result.finalHtml || ''}</div>`;
                
                compareDisplay.innerHTML = detailsHtml;
            } else {
                if (testData.language !== 'English') {
                    compareDisplay.classList.add('krutidev-text');
                } else {
                    compareDisplay.classList.remove('krutidev-text');
                }
                
                if (result.compareHtml) {
                    compareDisplay.innerHTML = result.compareHtml;
                } else {
                    compareDisplay.innerHTML = '<div class="text-center text-secondary">No detailed comparison available for this test.</div>';
                }
            }
            
            const modal = document.getElementById('compare-modal');
            modal.style.display = 'flex';
            setTimeout(() => modal.classList.add('active'), 10);
        } else {
            showToast("Test not found", "warning");
        }
    } catch (error) {
        console.error(error);
        showToast("Error", "error");
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
