/* ===================================================================
   HC Steno Wala — Utility Functions (utils.js)
   
   सभी पेजों में काम आने वाले common functions यहाँ हैं।
   Toast, Loading, Auth checks, Navbar generator आदि।
   =================================================================== */

// ═══════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Toast Container बनाना (body में append)
 * पेज लोड होते ही container बन जाएगा
 */
(function initToastContainer() {
  if (document.getElementById('toast-container')) return;
  const container = document.createElement('div');
  container.id = 'toast-container';
  container.className = 'toast-container';
  document.body.appendChild(container);
})();

/**
 * Toast notification दिखाना
 * @param {string} message - दिखाने का मेसेज
 * @param {string} type - 'success' | 'error' | 'warning' | 'info'
 * @param {number} duration - कितनी देर दिखाना (ms), default 3000
 */
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Icon map — टाइप के हिसाब से icon
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.parentElement.remove()" aria-label="Close">&times;</button>
  `;

  // Progress bar animation duration match
  const afterEl = toast.querySelector('.toast-close');
  toast.style.setProperty('--toast-duration', `${duration}ms`);

  container.appendChild(toast);

  // Auto remove
  const timer = setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, duration);

  // Close button clears timer
  toast.querySelector('.toast-close').addEventListener('click', () => {
    clearTimeout(timer);
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// LOADING SPINNER
// ═══════════════════════════════════════════════════════════════════════

/**
 * Loading overlay बनाना (अगर पहले से नहीं है)
 */
(function initLoadingOverlay() {
  if (document.getElementById('loading-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="spinner"></div>
    <p class="loading-text">कृपया प्रतीक्षा करें...</p>
  `;
  document.body.appendChild(overlay);
})();

/**
 * Full-page loading spinner दिखाना
 * @param {string} text - Loading text (optional)
 */
function showLoading(text) {
  const overlay = document.getElementById('loading-overlay');
  if (!overlay) return;
  if (text) {
    const textEl = overlay.querySelector('.loading-text');
    if (textEl) textEl.textContent = text;
  }
  overlay.classList.add('active');
}

/**
 * Loading spinner हटाना
 */
function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('active');
  }
}

// ═══════════════════════════════════════════════════════════════════════
// DATE & TIME FORMATTERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * Date को DD-MM-YYYY format में बदलना
 * @param {Date|string|number} date - Date object, string या timestamp
 * @returns {string} DD-MM-YYYY format
 */
function formatDate(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '--';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

/**
 * Seconds को MM:SS format में बदलना
 * @param {number} seconds - कुल सेकंड्स
 * @returns {string} MM:SS format
 */
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════
// AUTH HELPERS
// ═══════════════════════════════════════════════════════════════════════

/**
 * यूज़र लॉग-इन है या नहीं चेक करना
 * पहले localStorage चेक करता है, फिर Firebase auth state
 * @returns {boolean}
 */
function isLoggedIn() {
  const user = localStorage.getItem('hcsw_user');
  return !!user;
}

/**
 * Current logged-in user की info लेना
 * @returns {object|null} User object या null
 */
function getCurrentUser() {
  try {
    const userData = localStorage.getItem('hcsw_user');
    return userData ? JSON.parse(userData) : null;
  } catch (e) {
    console.error('Error parsing user data:', e);
    return null;
  }
}

/**
 * अगर यूज़र लॉग-इन नहीं है तो login पेज पर भेजना
 */
function redirectIfNotLoggedIn() {
  if (!isLoggedIn()) {
    window.location.href = 'index.html';
  }
}

/**
 * अगर यूज़र पहले से लॉग-इन है तो dashboard पर भेजना
 * Login/Register पेज पर काम आता है
 */
function redirectIfLoggedIn() {
  if (isLoggedIn()) {
    window.location.href = 'dashboard.html';
  }
}

/**
 * Firebase Auth state change listener
 * Real-time auth state sync करता है
 */
function setupAuthListener() {
  if (typeof firebase !== 'undefined' && window.auth) {
    window.auth.onAuthStateChanged(function(user) {
      if (!user) {
        // यूज़र logout हो गया — localStorage क्लीन करो
        localStorage.removeItem('hcsw_user');
      }
    });
  }
}

// Auth listener शुरू करना (जब DOM ready हो)
document.addEventListener('DOMContentLoaded', setupAuthListener);

// ═══════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════

/**
 * HTML special characters escape करना (XSS protection)
 * @param {string} str - Input string
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(str).replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * Random ID generate करना
 * @param {number} length - ID की लम्बाई (default 12)
 * @returns {string} Random alphanumeric ID
 */
function generateId(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Debounce function — बार-बार call होने से रोकना
 * जैसे search input में typing करते समय
 * @param {Function} fn - Function to debounce
 * @param {number} delay - Delay in ms (default 300)
 * @returns {Function} Debounced function
 */
function debounce(fn, delay = 300) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// ═══════════════════════════════════════════════════════════════════════
// NAVBAR GENERATOR
// ═══════════════════════════════════════════════════════════════════════

/**
 * Dynamic Navbar HTML बनाना
 * @param {string} activePage - Current active page identifier
 *   Values: 'home', 'typing', 'steno', 'scorecard', 'contact'
 * @returns {string} Navbar HTML string
 */
function createNavbar(activePage) {
  const user = getCurrentUser();
  const userName = user ? escapeHtml(user.name || 'User') : 'Guest';
  const userInitial = userName.charAt(0).toUpperCase();
  const isAdmin = user && user.role === 'admin';

  // Nav links — each with icon and label
  const navLinks = [
    { id: 'home',      href: 'dashboard.html',    icon: '🏠', label: 'Home' },
    { id: 'steno',     href: 'steno-tests.html',  icon: '🎤', label: 'Steno Dictation' },
    { id: 'typing',    href: 'typing-tests.html', icon: '⌨️', label: 'Typing Test' },
    { id: 'word',      href: 'word-tests.html',   icon: '📝', label: 'Word Efficiency' },
    { id: 'live-exams',href: 'live-exams.html',   icon: '⏱️', label: 'Live Exam' },
    { id: 'scorecard', href: 'scorecard.html',    icon: '📊', label: 'Scorecard' },
    { id: 'contact',   href: 'contact.html',      icon: '✉️', label: 'Contact' }
  ];

  const navLinksHtml = navLinks.map(function(link) {
    const activeClass = link.id === activePage ? ' active' : '';
    return `<a href="${link.href}" class="nav-link${activeClass}" id="nav-${link.id}">
      <span class="nav-icon">${link.icon}</span>
      <span>${link.label}</span>
    </a>`;
  }).join('');

  // Admin link (सिर्फ admin को दिखेगा)
  const adminLink = isAdmin
    ? `<a href="admin.html">🛡️ Admin Panel</a>`
    : '';

  return `
      <a href="dashboard.html" class="navbar-brand">
        <img src="assets/logo.png" alt="HC Steno Wala Logo">
        <span>HC Steno Wala</span>
      </a>

      <div class="navbar-nav" id="navbar-nav">
        ${navLinksHtml}
      </div>

      <div class="navbar-right">
        <div class="user-dropdown" id="user-dropdown">
          <button class="user-dropdown-toggle" id="user-dropdown-toggle" aria-label="User menu">
            <div class="user-avatar">${userInitial}</div>
            <span class="user-name">${userName}</span>
            <span class="dropdown-arrow">▼</span>
          </button>
          <div class="user-dropdown-menu" id="user-dropdown-menu">
            <a href="profile.html">👤 Profile</a>
            ${adminLink}
            <div class="divider"></div>
            <a href="#" class="logout-link" onclick="handleLogout(); return false;">🚪 Logout</a>
          </div>
        </div>

        <button class="hamburger" id="hamburger-btn" aria-label="Toggle menu">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
  `;
}

/**
 * Navbar को पेज में inject करना और event listeners सेट करना
 * @param {string} activePage - Current page identifier
 */
function initNavbar(activePage) {
  // Add navbar class if missing
  const navEl = document.getElementById('main-navbar');
  if (navEl && !navEl.classList.contains('navbar')) {
      navEl.classList.add('navbar');
  }

  // Hamburger toggle
  const hamburger = document.getElementById('hamburger-btn');
  const navbarNav = document.getElementById('navbar-nav');
  if (hamburger && navbarNav) {
    hamburger.addEventListener('click', function() {
      hamburger.classList.toggle('active');
      navbarNav.classList.toggle('open');
    });

    // Nav links click → close mobile menu
    navbarNav.querySelectorAll('.nav-link').forEach(function(link) {
      link.addEventListener('click', function() {
        hamburger.classList.remove('active');
        navbarNav.classList.remove('open');
      });
    });
  }

  // User dropdown toggle
  const dropdown = document.getElementById('user-dropdown');
  const dropdownToggle = document.getElementById('user-dropdown-toggle');
  if (dropdown && dropdownToggle) {
    dropdownToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    // Dropdown बाहर click करने पर बंद हो
    document.addEventListener('click', function(e) {
      if (!dropdown.contains(e.target)) {
        dropdown.classList.remove('open');
      }
    });
  }

  // Scroll पर navbar background change
  window.addEventListener('scroll', function() {
    const navbar = document.getElementById('main-navbar');
    if (navbar) {
      if (window.scrollY > 20) {
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.remove('scrolled');
      }
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════
// LOGOUT FUNCTION
// ═══════════════════════════════════════════════════════════════════════

/**
 * यूज़र को Logout करना
 * Firebase signOut + localStorage clear + redirect
 */
function handleLogout() {
  showLoading('Logging out...');
  
  if (typeof firebase !== 'undefined' && window.auth) {
    window.auth.signOut().then(function() {
      localStorage.removeItem('hcsw_user');
      showToast('Logout successful!', 'success');
      setTimeout(function() {
        window.location.href = 'index.html';
      }, 500);
    }).catch(function(error) {
      console.error('Logout error:', error);
      // Fallback — localStorage हटाकर redirect करो
      localStorage.removeItem('hcsw_user');
      window.location.href = 'index.html';
    });
  } else {
    // Firebase उपलब्ध नहीं — सिर्फ localStorage क्लीन करो
    localStorage.removeItem('hcsw_user');
    window.location.href = 'index.html';
  }
}

// ═══════════════════════════════════════════════════════════════════════
// PAGE UTILITIES
// ═══════════════════════════════════════════════════════════════════════

/**
 * Body पर class add करना (e.g., 'with-sidebar')
 */
function addBodyClass(className) {
  document.body.classList.add(className);
}

/**
 * Body से class remove करना
 */
function removeBodyClass(className) {
  document.body.classList.remove(className);
}
