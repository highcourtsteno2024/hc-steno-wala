document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();
    renderNavbar();
    
    const user = getCurrentUser();
    if (!user) return;
    
    // Load local storage data first
    document.getElementById('profile-name').innerText = user.name || 'User';
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-mobile').value = user.mobile || '';
    document.getElementById('profile-initial').innerText = (user.name || 'U').charAt(0).toUpperCase();
    
    const roleBadge = document.getElementById('profile-role');
    if (user.role === 'admin') {
        roleBadge.innerText = 'Administrator';
        roleBadge.className = 'badge badge-premium';
    } else {
        roleBadge.innerText = 'Student';
        roleBadge.className = 'badge badge-free';
    }
    
    // Fetch latest data from Firestore
    try {
        const doc = await window.db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            
            // Update UI
            document.getElementById('profile-name').innerText = data.name || user.name;
            document.getElementById('profile-mobile').value = data.mobile || user.mobile;
            
            // Update premium status
            const premiumBadge = document.getElementById('profile-premium-badge');
            if (data.isPremium) {
                premiumBadge.innerHTML = '<span class="badge badge-premium">Premium Member</span>';
                document.getElementById('profile-premium-status').innerText = 'You have full access to all premium tests.';
            } else {
                premiumBadge.innerHTML = '<span class="badge badge-free">Free User</span>';
                document.getElementById('profile-premium-status').innerText = 'Upgrade to unlock all premium dictations and features.';
            }
            
            // Update local storage just in case
            user.name = data.name || user.name;
            user.mobile = data.mobile || user.mobile;
            user.isPremium = data.isPremium || false;
            user.role = data.role || user.role;
            localStorage.setItem('hcsw_user', JSON.stringify(user));
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
});
