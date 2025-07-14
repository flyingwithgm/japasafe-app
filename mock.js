document.addEventListener('DOMContentLoaded', function() {
  // Check auth state
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'index.html';
    } else {
      loadQuestions(user.uid);
      loadFavorites(user.uid);
    }
  });
  
  // DOM elements
  const questionsList = document.getElementById('questionsList');
  const currentQuestion = document.getElementById('currentQuestion');
  const questionTips = document.getElementById('questionTips');
  const answerText = document.getElementById('answerText');
  const questionCategory = document.getElementById('questionCategory');
  const questionSearch = document.getElementById('questionSearch');
  const startPracticeBtn = document.getElementById('startPracticeBtn');
  const recordBtn = document.getElementById('recordBtn');
  const playBtn = document.getElementById('playBtn');
  const saveBtn = document.getElementById('saveBtn');
  const recordingStatus = document.getElementById('recordingStatus');
  
  // Variables
  let questions = [];
  let favorites = [];
  let currentQuestionId = null;
  let mediaRecorder;
  let audioChunks = [];
  let recordingInterval;
  let seconds = 0;
  
  // Event listeners
  questionCategory.addEventListener('change', filterQuestions);
  questionSearch.addEventListener('input', filterQuestions);
  startPracticeBtn.addEventListener('click', startPracticeSession);
  recordBtn.addEventListener('click', toggleRecording);
  playBtn.addEventListener('click', playRecording);
  saveBtn.addEventListener('click', saveAnswer);
  
  // Load questions from Firestore
  function loadQuestions(userId) {
    showLoaderInElement(questionsList);
    
    db.collection('questions').get()
      .then(querySnapshot => {
        questions = [];
        querySnapshot.forEach(doc => {
          questions.push({
            id: doc.id,
            ...doc.data()
          });
        });
        
        displayQuestions(questions);
        loadUserAnswers(userId);
      })
      .catch(error => {
        console.error('Error loading questions:', error);
        showToast('Error loading questions', 'error');
      });
  }
  
  // Load user's favorite questions
  function loadFavorites(userId) {
    db.collection('users').doc(userId).get()
      .then(doc => {
        if (doc.exists && doc.data().favorites) {
          favorites = doc.data().favorites;
          displayFavorites();
        }
      })
      .catch(error => {
        console.error('Error loading favorites:', error);
      });
  }
  
  // Load user's saved answers
  function loadUserAnswers(userId) {
    db.collection('users').doc(userId).collection('answers').get()
      .then(querySnapshot => {
        querySnapshot.forEach(doc => {
          const questionId = doc.data().questionId;
          const answerElement = document.querySelector(`.question-item[data-id="${questionId}"] .user-answer`);
          if (answerElement) {
            answerElement.style.display = 'block';
          }
        });
      })
      .catch(error => {
        console.error('Error loading user answers:', error);
      });
  }
  
  // Display questions in the list
  function displayQuestions(questionsToDisplay) {
    questionsList.innerHTML = '';
    
    if (questionsToDisplay.length === 0) {
      questionsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-question-circle"></i>
          <p>No questions found</p>
        </div>
      `;
      return;
    }
    
    questionsToDisplay.forEach(question => {
      const questionElement = document.createElement('div');
      questionElement.className = 'question-item';
      questionElement.setAttribute('data-id', question.id);
      questionElement.setAttribute('data-category', question.category);
      
      questionElement.innerHTML = `
        <div class="question-content">
          <h4>${question.text}</h4>
          <p class="question-category">${formatCategory(question.category)}</p>
        </div>
        <div class="question-actions">
          <button class="btn-icon practice-btn" title="Practice this question">
            <i class="fas fa-microphone"></i>
          </button>
          <button class="btn-icon favorite-btn" title="Add to favorites">
            <i class="far fa-star"></i>
          </button>
        </div>
        <div class="user-answer">
          <i class="fas fa-check-circle"></i>
          <span>You've practiced this</span>
        </div>
      `;
      
      questionsList.appendChild(questionElement);
      
      // Set favorite status
      const favoriteBtn = questionElement.querySelector('.favorite-btn');
      if (favorites.includes(question.id)) {
        favoriteBtn.innerHTML = '<i class="fas fa-star"></i>';
        favoriteBtn.classList.add('favorited');
      }
      
      // Add event listeners
      questionElement.querySelector('.practice-btn').addEventListener('click', () => {
        setCurrentQuestion(question);
      });
      
      favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(question.id, favoriteBtn);
      });
      
      // Click on question to set as current
      questionElement.addEventListener('click', () => {
        setCurrentQuestion(question);
      });
    });
  }
  
  // Display favorite questions
  function displayFavorites() {
    const favoritesGrid = document.getElementById('favoritesGrid');
    
    if (favorites.length === 0) {
      favoritesGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-star"></i>
          <h3>No favorite questions yet</h3>
          <p>Mark questions as favorite to save them here</p>
        </div>
      `;
      return;
    }
    
    favoritesGrid.innerHTML = '';
    
    // Filter questions to only include favorites
    const favoriteQuestions = questions.filter(q => favorites.includes(q.id));
    
    favoriteQuestions.forEach(question => {
      const favoriteElement = document.createElement('div');
      favoriteElement.className = 'favorite-card';
      favoriteElement.setAttribute('data-id', question.id);
      
      favoriteElement.innerHTML = `
        <div class="favorite-content">
          <h4>${question.text}</h4>
          <p class="question-category">${formatCategory(question.category)}</p>
        </div>
        <div class="favorite-actions">
          <button class="btn-icon practice-btn" title="Practice this question">
            <i class="fas fa-microphone"></i>
          </button>
          <button class="btn-icon remove-favorite-btn" title="Remove from favorites">
            <i class="fas fa-times"></i>
          </button>
        </div>
      `;
      
      favoritesGrid.appendChild(favoriteElement);
      
      // Add event listeners
      favoriteElement.querySelector('.practice-btn').addEventListener('click', () => {
        setCurrentQuestion(question);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      
      favoriteElement.querySelector('.remove-favorite-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(question.id);
      });
    });
  }
  
  // Set current question for practice
  function setCurrentQuestion(question) {
    currentQuestionId = question.id;
    currentQuestion.innerHTML = `<p>${question.text}</p>`;
    
    // Display tips for this question
    questionTips.innerHTML = question.tips || '<p>No specific tips available for this question.</p>';
    
    // Load any saved answer
    loadSavedAnswer(question.id);
    
    // Highlight selected question in list
    document.querySelectorAll('.question-item').forEach(item => {
      item.classList.remove('active');
      if (item.getAttribute('data-id') === question.id) {
        item.classList.add('active');
      }
    });
    
    // Enable practice buttons
    answerText.disabled = false;
    recordBtn.disabled = false;
  }
  
  // Load saved answer for a question
  function loadSavedAnswer(questionId) {
    const userId = auth.currentUser.uid;
    
    db.collection('users').doc(userId).collection('answers').where('questionId', '==', questionId).get()
      .then(querySnapshot => {
        if (!querySnapshot.empty) {
          const answerData = querySnapshot.docs[0].data();
          answerText.value = answerData.text || '';
          
          if (answerData.audioUrl) {
            // For audio answers, we'd display a player (implementation omitted for brevity)
          }
        } else {
          answerText.value = '';
        }
      })
      .catch(error => {
        console.error('Error loading answer:', error);
      });
  }
  
  // Filter questions based on category and search
  function filterQuestions() {
    const category = questionCategory.value;
    const searchTerm = questionSearch.value.toLowerCase();
    
    let filteredQuestions = questions;
    
    // Filter by category
    if (category !== 'all') {
      filteredQuestions = filteredQuestions.filter(q => q.category === category);
    }
    
    // Filter by search term
    if (searchTerm) {
      filteredQuestions = filteredQuestions.filter(q => 
        q.text.toLowerCase().includes(searchTerm) || 
        q.tips.toLowerCase().includes(searchTerm)
      );
    }
    
    displayQuestions(filteredQuestions);
  }
  
  // Toggle question as favorite
  function toggleFavorite(questionId, buttonElement = null) {
    const userId = auth.currentUser.uid;
    const wasFavorite = favorites.includes(questionId);
    
    if (wasFavorite) {
      favorites = favorites.filter(id => id !== questionId);
    } else {
      favorites.push(questionId);
    }
    
    // Update Firestore
    db.collection('users').doc(userId).update({
      favorites: favorites
    })
    .then(() => {
      // Update UI
      if (buttonElement) {
        if (wasFavorite) {
          buttonElement.innerHTML = '<i class="far fa-star"></i>';
          buttonElement.classList.remove('favorited');
        } else {
          buttonElement.innerHTML = '<i class="fas fa-star"></i>';
          buttonElement.classList.add('favorited');
          showToast('Question added to favorites', 'success');
        }
      }
      
      // Update favorites grid
      displayFavorites();
    })
    .catch(error => {
      console.error('Error updating favorites:', error);
      showToast('Error updating favorites', 'error');
    });
  }
  
  // Start a practice session (random questions)
  function startPracticeSession() {
    const category = questionCategory.value;
    let filteredQuestions = questions;
    
    if (category !== 'all') {
      filteredQuestions = questions.filter(q => q.category === category);
    }
    
    if (filteredQuestions.length === 0) {
      showToast('No questions available in this category', 'info');
      return;
    }
    
    // Get a random question
    const randomIndex = Math.floor(Math.random() * filteredQuestions.length);
    const randomQuestion = filteredQuestions[randomIndex];
    
    setCurrentQuestion(randomQuestion);
    
    // Scroll to question
    document.querySelector('.practice-area').scrollIntoView({ behavior: 'smooth' });
  }
  
  // Toggle recording
  function toggleRecording() {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      startRecording();
    } else {
      stopRecording();
    }
  }
  
  // Start audio recording
  function startRecording() {
    audioChunks = [];
    seconds = 0;
    
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        
        mediaRecorder.ondataavailable = event => {
          audioChunks.push(event.data);
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          // Here you would handle the audio blob (upload to storage, etc.)
          // Implementation omitted for brevity
        };
        
        mediaRecorder.start();
        updateRecordingUI(true);
        
        // Start timer
        recordingInterval = setInterval(() => {
          seconds++;
          const minutes = Math.floor(seconds / 60);
          const remainingSeconds = seconds % 60;
          document.querySelector('.recording-status .timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
        }, 1000);
      })
      .catch(error => {
        console.error('Error accessing microphone:', error);
        showToast('Error accessing microphone. Please check permissions.', 'error');
      });
  }
  
  // Stop audio recording
  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      clearInterval(recordingInterval);
      updateRecordingUI(false);
      
      // Stop all tracks
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
  }
  
  // Update recording UI
  function updateRecordingUI(isRecording) {
    if (isRecording) {
      recordBtn.innerHTML = '<i class="fas fa-stop"></i>';
      recordBtn.title = 'Stop Recording';
      recordingStatus.style.display = 'flex';
      playBtn.disabled = true;
      saveBtn.disabled = true;
    } else {
      recordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
      recordBtn.title = 'Record Answer';
      recordingStatus.style.display = 'none';
      playBtn.disabled = false;
      saveBtn.disabled = false;
    }
  }
  
  // Play recorded audio
  function playRecording() {
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    }
  }
  
  // Save answer (text or audio)
  function saveAnswer() {
    if (!currentQuestionId) return;
    
    const userId = auth.currentUser.uid;
    const answer = answerText.value.trim();
    
    if (answer === '' && audioChunks.length === 0) {
      showToast('Please record or type an answer', 'error');
      return;
    }
    
    showLoader();
    
    const answerData = {
      questionId: currentQuestionId,
      text: answer,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // If there's audio, upload it first
    if (audioChunks.length > 0) {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const storageRef = storage.ref(`users/${userId}/answers/${currentQuestionId}.wav`);
      
      storageRef.put(audioBlob)
        .then(snapshot => snapshot.ref.getDownloadURL())
        .then(audioUrl => {
          answerData.audioUrl = audioUrl;
          saveAnswerToFirestore(userId, answerData);
        })
        .catch(error => {
          hideLoader();
          console.error('Error uploading audio:', error);
          showToast('Error saving audio answer', 'error');
        });
    } else {
      saveAnswerToFirestore(userId, answerData);
    }
  }
  
  // Save answer data to Firestore
  function saveAnswerToFirestore(userId, answerData) {
    // Check if answer already exists
    db.collection('users').doc(userId).collection('answers').where('questionId', '==', currentQuestionId).get()
      .then(querySnapshot => {
        if (!querySnapshot.empty) {
          // Update existing answer
          const docId = querySnapshot.docs[0].id;
          return db.collection('users').doc(userId).collection('answers').doc(docId).update(answerData);
        } else {
          // Add new answer
          return db.collection('users').doc(userId).collection('answers').add(answerData);
        }
      })
      .then(() => {
        hideLoader();
        showToast('Answer saved successfully!', 'success');
        
        // Update UI to show this question has been practiced
        const questionElement = document.querySelector(`.question-item[data-id="${currentQuestionId}"]`);
        if (questionElement) {
          questionElement.querySelector('.user-answer').style.display = 'block';
        }
      })
      .catch(error => {
        hideLoader();
        console.error('Error saving answer:', error);
        showToast('Error saving answer', 'error');
      });
  }
  
  // Helper function to format category
  function formatCategory(category) {
    const categories = {
      personal: 'Personal Information',
      study: 'Study Plans',
      financial: 'Financial Situation',
      future: 'Future Plans',
      country: 'Host Country'
    };
    return categories[category] || category;
  }
  
  // Helper to show loader in specific element
  function showLoaderInElement(element) {
    element.innerHTML = `
      <div class="loader-spinner"></div>
    `;
  }
});
