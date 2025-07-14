document.addEventListener('DOMContentLoaded', function() {
  // Check auth state
  auth.onAuthStateChanged(user => {
    if (!user) {
      window.location.href = 'index.html';
    } else {
      loadUserDocuments(user.uid);
    }
  });
  
  // File upload elements
  const dropZone = document.getElementById('dropZone');
  const browseBtn = document.getElementById('browseBtn');
  const fileInput = document.getElementById('fileInput');
  const uploadProgress = document.getElementById('uploadProgress');
  const progressBar = document.getElementById('progressBar');
  const fileList = document.getElementById('fileList');
  const uploadStatus = document.getElementById('uploadStatus');
  
  // Set up drag and drop
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
  });
  
  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }
  
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, highlight, false);
  });
  
  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, unhighlight, false);
  });
  
  function highlight() {
    dropZone.classList.add('highlight');
  }
  
  function unhighlight() {
    dropZone.classList.remove('highlight');
  }
  
  // Handle dropped files
  dropZone.addEventListener('drop', handleDrop, false);
  
  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  }
  
  // Browse files button
  browseBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', () => {
    handleFiles(fileInput.files);
  });
  
  // Handle selected files
  function handleFiles(files) {
    if (files.length === 0) return;
    
    uploadProgress.style.display = 'block';
    fileList.innerHTML = '';
    
    const userId = auth.currentUser.uid;
    const uploadPromises = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type and size
      if (!validateFile(file)) continue;
      
      // Create file item in the list
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';
      fileItem.innerHTML = `
        <div class="file-info">
          <i class="fas fa-file-alt"></i>
          <span class="file-name">${file.name}</span>
        </div>
        <div class="file-status">
          <span class="status-text">Waiting...</span>
          <div class="progress-spinner"></div>
        </div>
      `;
      fileList.appendChild(fileItem);
      
      // Upload file to Firebase Storage
      const uploadPromise = uploadFile(userId, file, fileItem);
      uploadPromises.push(uploadPromise);
    }
    
    // Update overall progress
    if (uploadPromises.length > 0) {
      uploadStatus.textContent = 'Uploading...';
      
      Promise.all(uploadPromises)
        .then(() => {
          uploadStatus.textContent = 'Upload complete!';
          progressBar.style.width = '100%';
          loadUserDocuments(userId);
          
          setTimeout(() => {
            uploadProgress.style.display = 'none';
            progressBar.style.width = '0%';
            uploadStatus.textContent = 'Ready';
          }, 3000);
        })
        .catch(error => {
          console.error('Upload error:', error);
          uploadStatus.textContent = 'Upload failed';
          showToast('Some files failed to upload', 'error');
        });
    }
  }
  
  function validateFile(file) {
    const validTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (!validTypes.includes(file.type)) {
      showToast(`File type not supported: ${file.name}`, 'error');
      return false;
    }
    
    if (file.size > maxSize) {
      showToast(`File too large (max 10MB): ${file.name}`, 'error');
      return false;
    }
    
    return true;
  }
  
  function uploadFile(userId, file, fileItem) {
    return new Promise((resolve, reject) => {
      const storageRef = storage.ref(`users/${userId}/documents/${file.name}`);
      const uploadTask = storageRef.put(file);
      
      uploadTask.on('state_changed',
        (snapshot) => {
          // Progress monitoring
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          const statusText = fileItem.querySelector('.status-text');
          const progressSpinner = fileItem.querySelector('.progress-spinner');
          
          statusText.textContent = `${Math.round(progress)}%`;
          progressSpinner.style.background = `conic-gradient(var(--primary-color) ${progress}%, #eee ${progress}%)`;
          
          // Update overall progress bar
          const overallProgress = calculateOverallProgress();
          progressBar.style.width = `${overallProgress}%`;
        },
        (error) => {
          // Handle unsuccessful uploads
          fileItem.querySelector('.status-text').textContent = 'Failed';
          fileItem.classList.add('upload-failed');
          reject(error);
        },
        () => {
          // Handle successful uploads on complete
          uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
            fileItem.querySelector('.status-text').textContent = 'Done';
            fileItem.classList.add('upload-done');
            
            // Save document metadata to Firestore
            db.collection('users').doc(userId).collection('documents').add({
              name: file.name,
              type: file.type,
              size: file.size,
              url: downloadURL,
              uploadedAt: firebase.firestore.FieldValue.serverTimestamp(),
              category: 'other'
            })
            .then(() => {
              resolve();
            })
            .catch(error => {
              console.error('Error saving document metadata:', error);
              reject(error);
            });
          });
        }
      );
    });
  }
  
  function calculateOverallProgress() {
    const fileItems = document.querySelectorAll('.file-item');
    if (fileItems.length === 0) return 0;
    
    let totalProgress = 0;
    fileItems.forEach(item => {
      const statusText = item.querySelector('.status-text').textContent;
      if (statusText.includes('%')) {
        totalProgress += parseInt(statusText);
      } else if (statusText === 'Done') {
        totalProgress += 100;
      }
    });
    
    return Math.round(totalProgress / fileItems.length);
  }
  
  // Load user documents
  function loadUserDocuments(userId) {
    db.collection('users').doc(userId).collection('documents').orderBy('uploadedAt', 'desc')
      .get()
      .then(querySnapshot => {
        const documentsGrid = document.getElementById('documentsGrid');
        
        if (querySnapshot.empty) {
          documentsGrid.innerHTML = `
            <div class="empty-state">
              <i class="fas fa-folder-open"></i>
              <h3>No documents uploaded yet</h3>
              <p>Upload your first document to get started</p>
            </div>
          `;
          return;
        }
        
        documentsGrid.innerHTML = '';
        
        querySnapshot.forEach(doc => {
          const documentData = doc.data();
          const docElement = document.createElement('div');
          docElement.className = 'document-card';
          docElement.innerHTML = `
            <div class="doc-icon">
              ${getFileIcon(documentData.type)}
            </div>
            <div class="doc-info">
              <h4>${documentData.name}</h4>
              <p>${formatFileSize(documentData.size)} • ${documentData.uploadedAt.toDate().toLocaleDateString()}</p>
            </div>
            <div class="doc-actions">
              <button class="btn-icon view-btn" data-id="${doc.id}" data-url="${documentData.url}" data-type="${documentData.type}">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-icon download-btn" data-url="${documentData.url}">
                <i class="fas fa-download"></i>
              </button>
            </div>
          `;
          documentsGrid.appendChild(docElement);
        });
        
        // Add event listeners
        document.querySelectorAll('.view-btn').forEach(btn => {
          btn.addEventListener('click', openPreview);
        });
        
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
  
  function getFileIcon(fileType) {
    if (fileType === 'application/pdf') {
      return '<i class="fas fa-file-pdf"></i>';
    } else if (fileType.includes('image')) {
      return '<i class="fas fa-file-image"></i>';
    } else {
      return '<i class="fas fa-file-alt"></i>';
    }
  }
  
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
  
  // Document preview
  function openPreview(e) {
    const docId = e.currentTarget.getAttribute('data-id');
    const docUrl = e.currentTarget.getAttribute('data-url');
    const docType = e.currentTarget.getAttribute('data-type');
    
    const previewModal = document.getElementById('previewModal');
    const previewTitle = document.getElementById('previewTitle');
    const previewFrame = document.getElementById('previewFrame');
    const downloadBtn = document.getElementById('downloadBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    
    // Set document name in title
    const docName = e.currentTarget.closest('.document-card').querySelector('h4').textContent;
    previewTitle.textContent = docName;
    
    // Set download attribute
    downloadBtn.setAttribute('data-url', docUrl);
    
    // Set delete attribute
    deleteBtn.setAttribute('data-id', docId);
    
    // Display the document
    if (docType === 'application/pdf') {
      previewFrame.src = `https://docs.google.com/gview?url=${encodeURIComponent(docUrl)}&embedded=true`;
    } else if (docType.includes('image')) {
      previewFrame.src = docUrl;
    }
    
    previewModal.style.display = 'flex';
    
    // Close modal
    document.querySelector('.close-modal').addEventListener('click', () => {
      previewModal.style.display = 'none';
      previewFrame.src = '';
    });
    
    // Download button
    downloadBtn.addEventListener('click', () => {
      window.open(docUrl, '_blank');
    });
    
    // Delete button
    deleteBtn.addEventListener('click', deleteDocument);
  }
  
  function deleteDocument() {
    const docId = this.getAttribute('data-id');
    const userId = auth.currentUser.uid;
    
    if (confirm('Are you sure you want to delete this document?')) {
      showLoader();
      
      // First delete from Firestore
      db.collection('users').doc(userId).collection('documents').doc(docId).delete()
        .then(() => {
          // Note: In a real app, you'd also delete from Storage here
          hideLoader();
          showToast('Document deleted successfully', 'success');
          document.getElementById('previewModal').style.display = 'none';
          loadUserDocuments(userId);
        })
        .catch(error => {
          hideLoader();
          console.error('Error deleting document:', error);
          showToast('Error deleting document', 'error');
        });
    }
  }
});
