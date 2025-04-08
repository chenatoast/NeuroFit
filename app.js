// Modern Yoga Pose Detector - app.js

// Main application logic for the YogaTrack app
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startSessionBtn = document.getElementById('start-session-btn');
    const stopSessionBtn = document.getElementById('stop-session-btn');
    const saveSessionBtn = document.getElementById('save-session-btn');
    const sessionTimeElement = document.getElementById('session-time');
    const poseCountElement = document.getElementById('pose-count');
    const bestPoseElement = document.getElementById('best-pose');
    const avgConfidenceElement = document.getElementById('avg-confidence');
    const poseHistoryList = document.getElementById('pose-history-list');
    
    // Initialize PoseDetector
    const poseDetector = new PoseDetector();
    
    // Session state
    let sessionTimer = null;
    let sessionStartTimestamp = null;
    
    // Event listeners
    startSessionBtn.addEventListener('click', startSession);
    stopSessionBtn.addEventListener('click', stopSession);
    saveSessionBtn.addEventListener('click', saveSessionToCloud);
    
    // Initialize Firebase Authentication
    initializeFirebaseAuth();
    
    // Start a new yoga session
    async function startSession() {
        // Attempt to start the camera
        const cameraStarted = await poseDetector.startCamera();
        if (!cameraStarted) return;
        
        // Start the pose detection session
        poseDetector.startSession();
        sessionStartTimestamp = Date.now();
        
        // Update UI elements
        startSessionBtn.disabled = true;
        stopSessionBtn.disabled = false;
        saveSessionBtn.disabled = true;
        clearPoseHistory();
        
        // Start the session timer
        sessionTimer = setInterval(updateSessionTime, 1000);
    }
    
    // End the current yoga session
    function stopSession() {
        // Stop the camera
        poseDetector.stopCamera();
        
        // End the pose detection session and get results
        const sessionResults = poseDetector.endSession();
        
        // Stop the timer
        clearInterval(sessionTimer);
        
        // Update UI elements
        startSessionBtn.disabled = false;
        stopSessionBtn.disabled = true;
        saveSessionBtn.disabled = false;
    }
    
    // Update session timer display
    function updateSessionTime() {
        if (!sessionStartTimestamp) return;
        
        const elapsedMillis = Date.now() - sessionStartTimestamp;
        const elapsedSeconds = Math.floor(elapsedMillis / 1000);
        const minutes = Math.floor(elapsedSeconds / 60);
        const seconds = elapsedSeconds % 60;
        
        sessionTimeElement.textContent = `${padNumber(minutes)}:${padNumber(seconds)}`;
    }
    
    // Pad numbers with leading zero if needed
    function padNumber(num) {
        return num.toString().padStart(2, '0');
    }
    
    // Update session statistics based on pose detection
    function updateSessionStats(stats, detectedPoses) {
        // Update pose count
        poseCountElement.textContent = stats.count;
        
        // Update best pose
        if (stats.bestPose) {
            bestPoseElement.textContent = stats.bestPose.split(' ')[0]; // Just the first part of the pose name
        }
        
        // Update average confidence
        const avgConfidence = stats.count > 0 ? Math.round((stats.totalConfidence / stats.count) * 100) : 0;
        avgConfidenceElement.textContent = `${avgConfidence}%`;
        
        // Update pose history list
        updatePoseHistory(detectedPoses);
    }
    
    // Update pose history list in the UI
    function updatePoseHistory(detectedPoses) {
        // Clear the "no poses" message if needed
        if (detectedPoses.length > 0) {
            const emptyMessage = document.querySelector('.empty-history');
            if (emptyMessage) {
                emptyMessage.remove();
            }
        }
        
        // Get the latest pose
        const latestPose = detectedPoses[detectedPoses.length - 1];
        if (!latestPose) return;
        
        // Create a new list item for the pose
        const listItem = document.createElement('li');
        
        // Create name span
        const nameSpan = document.createElement('span');
        nameSpan.textContent = latestPose.name.split(' ')[0]; // Just the first part of the pose name
        
        // Create time span
        const timeSpan = document.createElement('span');
        timeSpan.classList.add('pose-time');
        timeSpan.textContent = latestPose.time;
        
        // Add spans to list item
        listItem.appendChild(nameSpan);
        listItem.appendChild(timeSpan);
        
        // Add to the list
        poseHistoryList.insertBefore(listItem, poseHistoryList.firstChild);
        
        // Limit to 10 items
        while (poseHistoryList.children.length > 10) {
            poseHistoryList.removeChild(poseHistoryList.lastChild);
        }
    }
    
    // Clear pose history list
    function clearPoseHistory() {
        poseHistoryList.innerHTML = '<li class="empty-history">No poses detected yet</li>';
        poseCountElement.textContent = '0';
        bestPoseElement.textContent = '-';
        avgConfidenceElement.textContent = '0%';
        sessionTimeElement.textContent = '00:00';
    }
    
    // Save session data to Firebase
    async function saveSessionToCloud() {
        try {
            // Check if user is signed in
            const user = firebase.auth().currentUser;
            if (!user) {
                await signInUser();
            }
            
            // Gather session data
            const sessionData = {
                userId: firebase.auth().currentUser.uid,
                date: new Date().toISOString(),
                duration: sessionTimeElement.textContent,
                totalPoses: parseInt(poseCountElement.textContent),
                bestPose: bestPoseElement.textContent,
                avgConfidence: avgConfidenceElement.textContent,
                poses: poseDetector.detectedPoses.map(pose => ({
                    name: pose.name,
                    time: pose.time,
                    confidence: pose.confidence
                }))
            };
            
            // Save to Firestore
            const sessionRef = await firebase.firestore().collection('yogaSessions').add(sessionData);
            
            // Show success message
            alert('Session saved successfully!');
            saveSessionBtn.disabled = true;
        } catch (error) {
            console.error('Error saving session:', error);
            alert('Error saving session. Please try again.');
        }
    }
    
    // Initialize Firebase Authentication and listen for auth state changes
    function initializeFirebaseAuth() {
        firebase.auth().onAuthStateChanged((user) => {
            if (user) {
                console.log('User signed in:', user.email);
                updateUIForSignedInUser(user);
            } else {
                console.log('No user signed in');
                updateUIForSignedOutUser();
            }
        });
    }
    
    // Sign in user (anonymous or with popup)
    async function signInUser() {
        try {
            // For simplicity, we'll use anonymous auth
            await firebase.auth().signInAnonymously();
        } catch (error) {
            console.error('Error signing in:', error);
            throw error;
        }
    }
    
    // Update UI for signed in user
    function updateUIForSignedInUser(user) {
        document.querySelector('.username').textContent = user.displayName || 'Yogi';
        document.querySelector('.status').innerHTML = '<i class="fas fa-circle"></i> Connected';
    }
    
    // Update UI for signed out user
    function updateUIForSignedOutUser() {
        document.querySelector('.username').textContent = 'Guest';
        document.querySelector('.status').innerHTML = '<i class="fas fa-circle" style="color: #dfe6e9;"></i> Offline';
    }
    
    // Make updateSessionStats globally available for the pose detector to call
    window.updateSessionStats = updateSessionStats;
});