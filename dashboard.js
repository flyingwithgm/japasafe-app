document.addEventListener('DOMContentLoaded', function() {
  // Check auth state
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'index.html';
    } else {
      loadUserData(user.uid);
      loadDocuments(user.uid);
    }
  });
  
  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      auth.signOut().then(() => {
        window.location.href = 'index.html';
      });
    });
  }
  
  // Date picker modal
  const dateModal = document.getElementById('dateModal');
  const setDateBtn = document.getElementById('setDateBtn');
  const saveDateBtn = document.getElementById('saveDateBtn');
  const closeModal = document.querySelector('.close-modal');
  
  if (setDateBtn) {
    setDateBtn.addEventListener('click', () => {
      dateModal.style.display = 'flex';
    });
  }
  
  if (closeModal) {
    closeModal.addEventListener('click', () => {
      dateModal.style.display = 'none';
    });
  }
  
  if (saveDateBtn) {
    saveDateBtn.addEventListener('click', saveInterviewDate);
  }
  
  // Initialize calendar
  initCalendar();
});

function loadUserData(userId) {
  db.collection('users').doc(userId).get()
    .then(doc => {
      if (doc.exists) {
        const userData = doc.data();
        
        // Update UI with user data
        document.getElementById('userName').textContent = userData.name;
        document.getElementById('userEmail').textContent = userData.email;
        document.getElementById('welcomeName').textContent = userData.name.split(' ')[0];
        
        // Display interview date if set
        if (userData.interviewDate) {
          const interviewDate = userData.interviewDate.toDate();
          const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' };
          document.getElementById('interviewDateDisplay').textContent = interviewDate.toLocaleDateString('en-US', options);
          
          // Calculate days left
          updateCountdown(interviewDate);
        }
      }
    })
    .catch(error => {
      console.error('Error loading user data:', error);
      showToast('Error loading user data', 'error');
    });
}

function loadDocuments(userId) {
  db.collection('users').doc(userId).collection('documents').orderBy('uploadedAt', 'desc').limit(3)
    .get()
    .then(querySnapshot => {
      const documentsList = document.getElementById('documentsList');
      
      if (querySnapshot.empty) {
        // Show empty state (already in HTML)
        return;
      }
      
      // Clear empty state
      documentsList.innerHTML = '';
      
      querySnapshot.forEach(doc => {
        const documentData = doc.data();
        const docElement = document.createElement('div');
        docElement.className = 'document-item';
        docElement.innerHTML = `
          <div class="doc-icon">
            <i class="fas fa-file-pdf"></i>
          </div>
          <div class="doc-info">
            <h4>${documentData.name}</h4>
            <p>Uploaded: ${documentData.uploadedAt.toDate().toLocaleDateString()}</p>
          </div>
          <div class="doc-actions">
            <button class="btn-icon download-btn" data-url="${documentData.url}">
              <i class="fas fa-download"></i>
            </button>
          </div>
        `;
        documentsList.appendChild(docElement);
      });
      
      // Update documents count
      document.getElementById('documentsCount').textContent = querySnapshot.size;
      
      // Add download event listeners
      document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const url = e.currentTarget.getAttribute('data-url');
          window.open(url, '_blank');
        });
      });
    })
    .catch(error => {
      console.error('Error loading documents:', error);
      showToast('Error loading documents', 'error');
    });
}

function saveInterviewDate() {
  const userId = auth.currentUser.uid;
  const date = document.getElementById('interviewDate').value;
  const time = document.getElementById('interviewTime').value;
  const location = document.getElementById('interviewLocation').value;
  
  if (!date || !time) {
    showToast('Please select both date and time', 'error');
    return;
  }
  
  const dateTime = new Date(`${date}T${time}`);
  
  db.collection('users').doc(userId).update({
    interviewDate: dateTime,
    interviewLocation: location || 'Not specified'
  })
  .then(() => {
    showToast('Interview date saved successfully!', 'success');
    loadUserData(userId);
    document.getElementById('dateModal').style.display = 'none';
  })
  .catch(error => {
    console.error('Error saving interview date:', error);
    showToast('Error saving interview date', 'error');
  });
}

function updateCountdown(interviewDate) {
  const now = new Date();
  const diffTime = interviewDate - now;
  
  if (diffTime <= 0) {
    document.getElementById('countdownDisplay').innerHTML = `
      <div class="countdown-alert">
        <i class="fas fa-exclamation-circle"></i>
        <span>Your interview date has passed</span>
      </div>
    `;
    document.getElementById('daysLeft').textContent = '0';
    return;
  }
  
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  document.getElementById('daysLeft').textContent = diffDays;
  
  const countdownElement = document.getElementById('countdownDisplay');
  countdownElement.innerHTML = `
    <div class="countdown-item">
      <span class="countdown-value">${diffDays}</span>
      <span class="countdown-label">Days</span>
    </div>
    <div class="countdown-item">
      <span class="countdown-value">${Math.floor((diffTime % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))}</span>
      <span class="countdown-label">Hours</span>
    </div>
  `;
  
  // Update every hour
  setTimeout(() => updateCountdown(interviewDate), 3600000);
}

function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) return;
  
  const calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    events: function(fetchInfo, successCallback, failureCallback) {
      const userId = auth.currentUser.uid;
      db.collection('users').doc(userId).get()
        .then(doc => {
          const events = [];
          const userData = doc.data();
          
          if (userData.interviewDate) {
            events.push({
              title: 'Visa Interview',
              start: userData.interviewDate.toDate(),
              allDay: false,
              color: '#f72585',
              textColor: '#ffffff'
            });
          }
          
          // Add document deadlines if any
          if (userData.documentDeadlines) {
            userData.documentDeadlines.forEach(deadline => {
              events.push({
                title: `${deadline.name} Deadline`,
                start: deadline.date.toDate(),
                allDay: true,
                color: '#4361ee'
              });
            });
          }
          
          successCallback(events);
        })
        .catch(error => {
          console.error('Error loading calendar events:', error);
          failureCallback(error);
        });
    },
    eventClick: function(info) {
      alert(`Event: ${info.event.title}\nDate: ${info.event.start.toLocaleString()}`);
    }
  });
  
  calendar.render();
}
