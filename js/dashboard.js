document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('main-navbar').innerHTML = createNavbar('home');
    redirectIfNotLoggedIn();
    
    const user = getCurrentUser();
    if (!user) return;
    
    initNavbar();
    document.getElementById('welcome-msg').innerText = `डैशबोर्ड - Welcome, ${user.name}`;
    
    loadStats(user.uid);
});

async function loadStats(userId) {
    try {
        // Load Total Tests Count
        const testsSnap = await window.db.collection('tests').get();
        document.getElementById('stat-total-tests').innerText = testsSnap.size;
        
        // Load User Results
        const resultsRef = window.db.collection('results').where('userId', '==', userId).orderBy('timestamp', 'desc');
        const snapshot = await resultsRef.get();
        
        const attempted = snapshot.size;
        document.getElementById('stat-attempted').innerText = attempted;
        
        let totalMarks = 0;
        let bestRank = Infinity;
        
        const recentBody = document.getElementById('recent-tests-body');
        let recentHtml = '';
        
        if (attempted === 0) {
            document.getElementById('stat-avg-score').innerText = '0%';
            document.getElementById('stat-best-rank').innerText = '-';
            recentBody.innerHTML = '<tr><td colspan="4" class="text-center">आपने अभी तक कोई टेस्ट नहीं दिया है।</td></tr>';
            return;
        }
        
        let count = 0;
        snapshot.forEach(doc => {
            const data = doc.data();
            totalMarks += (data.marks || 0);
            if (data.rank && data.rank < bestRank) {
                bestRank = data.rank;
            }
            
            // Generate recent tests html (up to 5)
            if (count < 5) {
                const dateStr = formatDate(new Date(data.timestamp?.toDate ? data.timestamp.toDate() : data.timestamp));
                recentHtml += `
                    <tr>
                        <td>${dateStr}</td>
                        <td>${escapeHtml(data.testName || 'Unknown')}</td>
                        <td class="${data.marks >= 80 ? 'text-success' : ''}">${(data.marks || 0).toFixed(2)}%</td>
                        <td>
                            <button class="btn btn-secondary btn-sm" onclick="window.location.href='scorecard.html'">View Details</button>
                        </td>
                    </tr>
                `;
            }
            count++;
        });
        
        const avgScore = (totalMarks / attempted).toFixed(2);
        document.getElementById('stat-avg-score').innerText = `${avgScore}%`;
        document.getElementById('stat-best-rank').innerText = bestRank === Infinity ? '-' : bestRank;
        
        recentBody.innerHTML = recentHtml;
        
    } catch (error) {
        console.error("Error loading stats:", error);
        showToast("डेटा लोड करने में त्रुटि", "error");
    }
}
