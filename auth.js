// Auth State Listener
auth.onAuthStateChanged(user => {
  if (user) {
    // User is signed in
    console.log('User logged in:', user.email);
    // Redirect to dashboard
    window.location.href = 'dashboard.html';
  } else {
    // User is signed out
    console.log('User signed out');
  }
});

// Login Form
const loginForm = document.getElementById('loginForm');
if (loginForm) {
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoader();
    
    auth.signInWithEmailAndPassword(email, password)
      .then(() => {
        hideLoader();
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);
      })
      .catch(error => {
        hideLoader();
        showToast(error.message, 'error');
      });
  });
}

// Signup Form
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('signupConfirm').value;
    
    if (password !== confirmPassword) {
      showToast('Passwords do not match', 'error');
      return;
    }
    
    showLoader();
    
    auth.createUserWithEmailAndPassword(email, password)
      .then((userCredential) => {
        // Add user data to Firestore
        return db.collection('users').doc(userCredential.user.uid).set({
          name: name,
          email: email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          interviewDate: null,
          documents: [],
          favorites: []
        });
      })
      .then(() => {
        hideLoader();
        showToast('Account created successfully!', 'success');
        setTimeout(() => {
          window.location.href = 'dashboard.html';
        }, 1500);
      })
      .catch(error => {
        hideLoader();
        showToast(error.message, 'error');
      });
  });
}

// Helper Functions
function showLoader() {
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.innerHTML = `
    <div class="loader-spinner"></div>
  `;
  document.body.appendChild(loader);
}

function hideLoader() {
  const loader = document.querySelector('.loader');
  if (loader) {
    loader.remove();
  }
}

function showToast(message, type) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}
