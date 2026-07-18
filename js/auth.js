/* ===================================================================
   HC Steno Wala — Authentication Logic (auth.js)
   
   Login, Register, Forgot Password, Password Toggle
   Firebase Authentication + Firestore user profile
   =================================================================== */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  // CHECK IF ALREADY LOGGED IN — Auth pages पर redirect करना
  // ═══════════════════════════════════════════════════════════════════
  if (isLoggedIn()) {
    window.location.href = 'dashboard.html';
    return; // बाकी कोड execute मत करो
  }

  // ═══════════════════════════════════════════════════════════════════
  // DOM READY
  // ═══════════════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function() {
    initLoginForm();
    initRegisterForm();
    initPasswordToggles();
    initForgotPassword();
  });

  // ═══════════════════════════════════════════════════════════════════
  // LOGIN FORM HANDLER
  // ═══════════════════════════════════════════════════════════════════
  function initLoginForm() {
    var form = document.getElementById('login-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      handleLogin();
    });
  }

  /**
   * Login form submission handler
   * Mobile number को email format में convert करके Firebase से authenticate करता है
   */
  function handleLogin() {
    // Fields
    var mobileInput = document.getElementById('login-mobile');
    var passwordInput = document.getElementById('login-password');
    var submitBtn = document.getElementById('login-submit-btn');

    // Values
    var mobile = mobileInput.value.trim();
    var password = passwordInput.value;

    // Reset errors
    clearErrors();

    // ── Validation ──
    var isValid = true;

    // Mobile validation — 10 digit Indian number
    if (!mobile) {
      showFieldError('login-mobile-error', 'मोबाइल नंबर दर्ज करें');
      mobileInput.classList.add('error');
      isValid = false;
    } else if (!/^[6-9]\d{9}$/.test(mobile)) {
      showFieldError('login-mobile-error', 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें');
      mobileInput.classList.add('error');
      isValid = false;
    }

    // Password validation
    if (!password) {
      showFieldError('login-password-error', 'पासवर्ड दर्ज करें');
      passwordInput.classList.add('error');
      isValid = false;
    } else if (password.length < 6) {
      showFieldError('login-password-error', 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए');
      passwordInput.classList.add('error');
      isValid = false;
    }

    if (!isValid) return;

    // ── Firebase Authentication ──
    // Mobile number को email format में convert: 9799867629@hcstenowala.com
    var email = mobile + '@hcstenowala.com';

    // Button disable + loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:8px;border-top-color:#fff;"></span> Signing In...';
    showLoading('Logging in...');

    window.auth.signInWithEmailAndPassword(email, password)
      .then(function(userCredential) {
        var user = userCredential.user;

        // Firestore से user profile लाना
        return window.db.collection('users').doc(user.uid).get()
          .then(function(doc) {
            var userData = {
              uid: user.uid,
              email: user.email,
              name: 'User',
              mobile: mobile,
              role: 'student',
              isPremium: false
            };

            if (doc.exists) {
              var profileData = doc.data();
              userData.name = profileData.name || userData.name;
              userData.mobile = profileData.mobile || mobile;
              userData.role = profileData.role || 'student';
              userData.isPremium = profileData.isPremium || false;
              userData.profileEmail = profileData.email || '';
            }

            // localStorage में save करना
            localStorage.setItem('hcsw_user', JSON.stringify(userData));

            hideLoading();
            showToast('Login successful! Welcome back 🎉', 'success');

            // Dashboard पर redirect (थोड़ी देर बाद ताकि toast दिखे)
            setTimeout(function() {
              window.location.href = 'dashboard.html';
            }, 800);
          });
      })
      .catch(function(error) {
        hideLoading();
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'SIGN IN';

        // Error handling — Firebase error codes
        var errorMessage = 'Login failed. कृपया दोबारा कोशिश करें।';

        switch (error.code) {
          case 'auth/user-not-found':
            errorMessage = 'यह मोबाइल नंबर registered नहीं है। कृपया पहले Register करें।';
            mobileInput.classList.add('error');
            break;
          case 'auth/wrong-password':
            errorMessage = 'गलत पासवर्ड। कृपया सही पासवर्ड दर्ज करें।';
            passwordInput.classList.add('error');
            break;
          case 'auth/invalid-email':
            errorMessage = 'अमान्य मोबाइल नंबर format।';
            mobileInput.classList.add('error');
            break;
          case 'auth/user-disabled':
            errorMessage = 'यह अकाउंट बंद कर दिया गया है। Admin से संपर्क करें।';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'बहुत अधिक प्रयास। कृपया कुछ देर बाद कोशिश करें।';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'इंटरनेट कनेक्शन चेक करें।';
            break;
          case 'auth/invalid-credential':
            errorMessage = 'गलत मोबाइल नंबर या पासवर्ड। कृपया दोबारा चेक करें।';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }

        showToast(errorMessage, 'error', 5000);
        console.error('Login error:', error);
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // REGISTER FORM HANDLER
  // ═══════════════════════════════════════════════════════════════════
  function initRegisterForm() {
    var form = document.getElementById('register-form');
    if (!form) return;

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      handleRegister();
    });
  }

  /**
   * Register form submission handler
   * Firebase account create + Firestore profile save
   */
  function handleRegister() {
    // Fields
    var nameInput = document.getElementById('register-name');
    var mobileInput = document.getElementById('register-mobile');
    var emailInput = document.getElementById('register-email');
    var passwordInput = document.getElementById('register-password');
    var confirmPasswordInput = document.getElementById('register-confirm-password');
    var submitBtn = document.getElementById('register-submit-btn');

    // Values
    var name = nameInput.value.trim();
    var mobile = mobileInput.value.trim();
    var email = emailInput.value.trim();
    var password = passwordInput.value;
    var confirmPassword = confirmPasswordInput.value;

    // Reset errors
    clearErrors();

    // ── Validation ──
    var isValid = true;

    // Name validation
    if (!name) {
      showFieldError('register-name-error', 'अपना नाम दर्ज करें');
      nameInput.classList.add('error');
      isValid = false;
    } else if (name.length < 2) {
      showFieldError('register-name-error', 'नाम कम से कम 2 अक्षर का होना चाहिए');
      nameInput.classList.add('error');
      isValid = false;
    }

    // Mobile validation
    if (!mobile) {
      showFieldError('register-mobile-error', 'मोबाइल नंबर दर्ज करें');
      mobileInput.classList.add('error');
      isValid = false;
    } else if (!/^[6-9]\d{9}$/.test(mobile)) {
      showFieldError('register-mobile-error', 'कृपया सही 10 अंकों का मोबाइल नंबर दर्ज करें');
      mobileInput.classList.add('error');
      isValid = false;
    }

    // Email validation
    if (!email) {
      showFieldError('register-email-error', 'ईमेल दर्ज करें');
      emailInput.classList.add('error');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showFieldError('register-email-error', 'कृपया सही ईमेल दर्ज करें');
      emailInput.classList.add('error');
      isValid = false;
    }

    // Password validation
    if (!password) {
      showFieldError('register-password-error', 'पासवर्ड दर्ज करें');
      passwordInput.classList.add('error');
      isValid = false;
    } else if (password.length < 6) {
      showFieldError('register-password-error', 'पासवर्ड कम से कम 6 अक्षर का होना चाहिए');
      passwordInput.classList.add('error');
      isValid = false;
    }

    // Confirm Password
    if (!confirmPassword) {
      showFieldError('register-confirm-password-error', 'पासवर्ड दोबारा दर्ज करें');
      confirmPasswordInput.classList.add('error');
      isValid = false;
    } else if (password !== confirmPassword) {
      showFieldError('register-confirm-password-error', 'पासवर्ड मैच नहीं कर रहा');
      confirmPasswordInput.classList.add('error');
      isValid = false;
    }

    if (!isValid) return;

    // ── Firebase Registration ──
    // Mobile number को auth email format में convert
    var authEmail = mobile + '@hcstenowala.com';

    // Button disable + loading
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner spinner-sm" style="display:inline-block;vertical-align:middle;margin-right:8px;border-top-color:#fff;"></span> Registering...';
    showLoading('Creating account...');

    window.auth.createUserWithEmailAndPassword(authEmail, password)
      .then(function(userCredential) {
        var user = userCredential.user;

        // Display name set करना
        return user.updateProfile({
          displayName: name
        }).then(function() {
          // Firestore में user profile save करना
          return window.db.collection('users').doc(user.uid).set({
            name: name,
            mobile: mobile,
            email: email,
            role: email.toLowerCase() === 'highcourtsteno2024@gmail.com' ? 'admin' : 'student',
            isPremium: false,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            lastLogin: firebase.firestore.FieldValue.serverTimestamp()
          });
        }).then(function() {
          // localStorage में save
          var userData = {
            uid: user.uid,
            email: authEmail,
            name: name,
            mobile: mobile,
            profileEmail: email,
            role: email.toLowerCase() === 'highcourtsteno2024@gmail.com' ? 'admin' : 'student',
            isPremium: false
          };
          localStorage.setItem('hcsw_user', JSON.stringify(userData));

          hideLoading();
          showToast('Registration successful! Welcome 🎉', 'success');

          // Dashboard पर redirect
          setTimeout(function() {
            window.location.href = 'dashboard.html';
          }, 800);
        });
      })
      .catch(function(error) {
        hideLoading();
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'REGISTER';

        var errorMessage = 'Registration failed. कृपया दोबारा कोशिश करें।';

        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = 'यह मोबाइल नंबर पहले से registered है। कृपया Login करें।';
            mobileInput.classList.add('error');
            break;
          case 'auth/invalid-email':
            errorMessage = 'अमान्य मोबाइल नंबर format।';
            mobileInput.classList.add('error');
            break;
          case 'auth/weak-password':
            errorMessage = 'पासवर्ड बहुत कमज़ोर है। कम से कम 6 अक्षर रखें।';
            passwordInput.classList.add('error');
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Registration अभी बंद है। Admin से संपर्क करें।';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'इंटरनेट कनेक्शन चेक करें।';
            break;
          default:
            errorMessage = error.message || errorMessage;
        }

        showToast(errorMessage, 'error', 5000);
        console.error('Register error:', error);
      });
  }

  // ═══════════════════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ═══════════════════════════════════════════════════════════════════
  function initForgotPassword() {
    var forgotLink = document.getElementById('forgot-password-link');
    var modalOverlay = document.getElementById('forgot-modal-overlay');
    var modalClose = document.getElementById('forgot-modal-close');
    var modalCancel = document.getElementById('forgot-modal-cancel');
    var submitBtn = document.getElementById('forgot-submit-btn');

    if (!forgotLink || !modalOverlay) return;

    // Modal खोलना
    forgotLink.addEventListener('click', function(e) {
      e.preventDefault();
      modalOverlay.classList.add('active');
      // Email field focus
      setTimeout(function() {
        var emailField = document.getElementById('forgot-email');
        if (emailField) emailField.focus();
      }, 300);
    });

    // Modal बंद करना
    function closeModal() {
      modalOverlay.classList.remove('active');
      var emailField = document.getElementById('forgot-email');
      var errorField = document.getElementById('forgot-email-error');
      if (emailField) {
        emailField.value = '';
        emailField.classList.remove('error');
      }
      if (errorField) {
        errorField.classList.remove('show');
        errorField.textContent = '';
      }
    }

    if (modalClose) modalClose.addEventListener('click', closeModal);
    if (modalCancel) modalCancel.addEventListener('click', closeModal);

    // Overlay click से modal बंद
    modalOverlay.addEventListener('click', function(e) {
      if (e.target === modalOverlay) closeModal();
    });

    // Escape key से modal बंद
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modalOverlay.classList.contains('active')) {
        closeModal();
      }
    });

    // Send Reset Link
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        var emailField = document.getElementById('forgot-email');
        var errorField = document.getElementById('forgot-email-error');
        var email = emailField.value.trim();

        // Reset
        emailField.classList.remove('error');
        errorField.classList.remove('show');

        // Validation
        if (!email) {
          showFieldError('forgot-email-error', 'ईमेल दर्ज करें');
          emailField.classList.add('error');
          return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showFieldError('forgot-email-error', 'कृपया सही ईमेल दर्ज करें');
          emailField.classList.add('error');
          return;
        }

        // Button state
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';

        // Firebase password reset
        window.auth.sendPasswordResetEmail(email)
          .then(function() {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';
            closeModal();
            showToast('Password reset email भेज दिया गया है। अपना email चेक करें।', 'success', 5000);
          })
          .catch(function(error) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Reset Link';

            var errorMsg = 'Error sending reset email.';
            if (error.code === 'auth/user-not-found') {
              errorMsg = 'यह email registered नहीं है।';
            } else if (error.code === 'auth/invalid-email') {
              errorMsg = 'अमान्य email format।';
            } else if (error.code === 'auth/too-many-requests') {
              errorMsg = 'बहुत अधिक प्रयास। कृपया बाद में कोशिश करें।';
            }

            showFieldError('forgot-email-error', errorMsg);
            emailField.classList.add('error');
            console.error('Forgot password error:', error);
          });
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // PASSWORD VISIBILITY TOGGLE
  // ═══════════════════════════════════════════════════════════════════
  function initPasswordToggles() {
    // Login page toggle
    setupToggle('login-toggle-password', 'login-password');
    
    // Register page toggles
    setupToggle('register-toggle-password', 'register-password');
    setupToggle('register-toggle-confirm-password', 'register-confirm-password');
  }

  /**
   * Password field toggle setup करना
   * @param {string} toggleId - Toggle button ID
   * @param {string} inputId - Password input ID
   */
  function setupToggle(toggleId, inputId) {
    var toggle = document.getElementById(toggleId);
    var input = document.getElementById(inputId);
    if (!toggle || !input) return;

    toggle.addEventListener('click', function() {
      if (input.type === 'password') {
        input.type = 'text';
        toggle.textContent = '🙈';
        toggle.title = 'Hide password';
      } else {
        input.type = 'password';
        toggle.textContent = '👁️';
        toggle.title = 'Show password';
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPER FUNCTIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Field error दिखाना
   * @param {string} errorId - Error element ID
   * @param {string} message - Error message
   */
  function showFieldError(errorId, message) {
    var errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.add('show');
    }
  }

  /**
   * सभी errors clear करना
   */
  function clearErrors() {
    // Error messages हटाना
    document.querySelectorAll('.form-error').forEach(function(el) {
      el.classList.remove('show');
      el.textContent = '';
    });

    // Error styling हटाना
    document.querySelectorAll('.form-control.error').forEach(function(el) {
      el.classList.remove('error');
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // INPUT FORMATTING — only digits in mobile field
  // ═══════════════════════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function() {
    var mobileFields = document.querySelectorAll('input[type="tel"]');
    mobileFields.forEach(function(field) {
      field.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 10);
      });
    });
  });

})();
