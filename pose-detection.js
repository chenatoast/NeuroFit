// Modern Yoga Pose Detector - pose-detection.js

class PoseDetector {
    constructor() {
        // DOM elements
        this.video = document.getElementById('webcam');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.poseNameElement = document.getElementById('pose-name');
        this.confidenceFill = document.getElementById('confidence-fill');
        this.confidenceText = document.getElementById('confidence-text');
        
        // MediaPipe Pose Configuration
        this.pose = null;
        this.camera = null;
        this.isRunning = false;
        this.isModelLoaded = false;
        
        // Session data
        this.sessionStartTime = null;
        this.sessionActive = false;
        this.detectedPoses = [];
        this.poseStats = {
            count: 0,
            bestPose: null,
            bestConfidence: 0,
            totalConfidence: 0
        };
        
        // Pose detection configuration
        this.detectionThreshold = 0.65; // Minimum confidence to register a pose
        this.poseSustainTime = 1000; // Time in ms a pose must be held to count
        this.currentPoseStartTime = null;
        this.lastDetectedPose = null;
        this.lastPoseConfidence = 0;
        this.currentPoseCounted = false;
        
        // Yoga pose definitions
        this.yogaPoses = this.initYogaPoses();
    }
    
    // Initialize the pose definitions
    initYogaPoses() {
        return {
            'Mountain Pose (Tadasana)': {
                description: 'Standing straight, arms at sides',
                check: (landmarks) => {
                    return (
                        this.isBodyStraight(landmarks) &&
                        this.areArmsAtSides(landmarks) &&
                        this.areLegsStaight(landmarks)
                    );
                }
            },
            'Tree Pose (Vrikshasana)': {
                description: 'Standing on one leg, foot on inner thigh',
                check: (landmarks) => {
                    return (
                        this.isLegBent(landmarks) &&
                        this.areArmsRaised(landmarks)
                    );
                }
            },
            'Warrior II (Virabhadrasana II)': {
                description: 'Legs spread, arms extended to sides',
                check: (landmarks) => {
                    return (
                        this.areLegsSpread(landmarks) &&
                        this.areArmsExtendedSides(landmarks)
                    );
                }
            },
            'Triangle Pose (Trikonasana)': {
                description: 'Legs spread, body bent to side',
                check: (landmarks) => {
                    return (
                        this.areLegsSpread(landmarks) &&
                        this.isBodyBentSide(landmarks) &&
                        this.areArmsVertical(landmarks)
                    );
                }
            },
            'Downward Dog (Adho Mukha Svanasana)': {
                description: 'Inverted V shape',
                check: (landmarks) => {
                    return this.isInvertedV(landmarks);
                }
            },
            'Cobra Pose (Bhujangasana)': {
                description: 'Lying on stomach, chest up, arms pressing',
                check: (landmarks) => {
                    return this.isCobraPose(landmarks);
                }
            },
            'Chair Pose (Utkatasana)': {
                description: 'Knees bent, arms raised overhead',
                check: (landmarks) => {
                    return (
                        this.areKneesBent(landmarks) &&
                        this.areArmsRaised(landmarks)
                    );
                }
            }
        };
    }

    // Set up MediaPipe Pose and initialize
    async setup() {
        try {
            document.getElementById('loading-overlay').style.display = 'flex';
            
            this.pose = new Pose({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
                }
            });
            
            this.pose.setOptions({
                modelComplexity: 1,
                smoothLandmarks: true,
                minDetectionConfidence: 0.5,
                minTrackingConfidence: 0.5
            });
            
            // Register the callback for processing pose results
            this.pose.onResults((results) => this.onResults(results));
            
            // Wait for the model to load
            await this.pose.initialize();
            this.isModelLoaded = true;
            
            document.getElementById('loading-overlay').style.display = 'none';
            return true;
        } catch (error) {
            console.error('Error setting up pose detection:', error);
            document.getElementById('loading-overlay').style.display = 'none';
            return false;
        }
    }

    // Process pose results from MediaPipe
    onResults(results) {
        if (!this.sessionActive) return;
        
        // Clear canvas and draw the pose landmarks
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        if (results.poseLandmarks) {
            // Draw pose landmarks
            drawConnectors(this.ctx, results.poseLandmarks, POSE_CONNECTIONS, 
                {color: 'rgba(108, 92, 231, 0.8)', lineWidth: 4});
            drawLandmarks(this.ctx, results.poseLandmarks, 
                {color: 'rgba(253, 121, 168, 1)', lineWidth: 2, radius: 4});
            
            // Identify the pose
            const poseResult = this.identifyPose(results.poseLandmarks);
            
            // Update the UI
            this.updatePoseUI(poseResult);
            
            // Process pose for session stats
            this.processPoseForStats(poseResult);
        }
    }

    // Identify the yoga pose based on body landmarks
    identifyPose(landmarks) {
        let bestMatch = null;
        let highestConfidence = 0;
        
        for (const [poseName, poseDefinition] of Object.entries(this.yogaPoses)) {
            try {
                // Check if pose matches our criteria
                const isMatch = poseDefinition.check(landmarks);
                
                // Simple confidence scoring
                let confidence = isMatch ? 0.85 : 0;
                
                // Apply geometric refinement for better confidence estimation
                if (isMatch) {
                    confidence = this.refinePoseConfidence(poseName, landmarks, confidence);
                }
                
                if (confidence > highestConfidence) {
                    highestConfidence = confidence;
                    bestMatch = poseName;
                }
            } catch (err) {
                console.error(`Error checking ${poseName}:`, err);
            }
        }
        
        // Only return a pose if we're reasonably confident
        if (highestConfidence > this.detectionThreshold) {
            return {
                pose: bestMatch,
                confidence: highestConfidence
            };
        } else {
            return {
                pose: 'No pose detected',
                confidence: 0
            };
        }
    }

    // Refine confidence based on geometric criteria
    refinePoseConfidence(poseName, landmarks, baseConfidence) {
        let confidenceMultiplier = 1.0;
        
        // Apply different refinement techniques based on the pose
        switch(poseName) {
            case 'Mountain Pose (Tadasana)':
                // Check if the body is perfectly straight
                const verticalAlignment = this.calculateVerticalAlignment(landmarks);
                confidenceMultiplier *= (1 - (verticalAlignment * 0.5));
                break;
                
            case 'Tree Pose (Vrikshasana)':
                // Check how well the weight is balanced on one foot
                const balanceQuality = this.calculateBalanceQuality(landmarks);
                confidenceMultiplier *= balanceQuality;
                break;
                
            // Add cases for other poses as needed
        }
        
        return Math.min(baseConfidence * confidenceMultiplier, 1.0);
    }

    // Calculate vertical alignment for pose refinement
    calculateVerticalAlignment(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        
        // Calculate deviation from perfect vertical alignment
        const shoulderMidpointX = (leftShoulder.x + rightShoulder.x) / 2;
        const hipMidpointX = (leftHip.x + rightHip.x) / 2;
        const ankleMidpointX = (leftAnkle.x + rightAnkle.x) / 2;
        
        return Math.abs(shoulderMidpointX - hipMidpointX) + 
               Math.abs(hipMidpointX - ankleMidpointX);
    }

    // Calculate balance quality for Tree Pose
    calculateBalanceQuality(landmarks) {
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];
        
        // Check which leg is supporting weight
        const leftLegStraight = Math.abs(leftKnee.y - leftAnkle.y) > 0.1;
        const rightLegStraight = Math.abs(rightKnee.y - rightAnkle.y) > 0.1;
        
        if (leftLegStraight && !rightLegStraight) {
            // Left leg is supporting
            return 0.9;
        } else if (!leftLegStraight && rightLegStraight) {
            // Right leg is supporting
            return 0.9;
        } else {
            // Not clearly balanced on one leg
            return 0.6;
        }
    }

    // Process pose for session statistics
    processPoseForStats(poseResult) {
        if (poseResult.pose === 'No pose detected') {
            this.currentPoseStartTime = null;
            this.lastDetectedPose = null;
            return;
        }
        
        const now = Date.now();
        
        // Check if this is a new pose or continuing the same pose
        if (this.lastDetectedPose !== poseResult.pose) {
            // New pose detected, reset the timer
            this.lastDetectedPose = poseResult.pose;
            this.lastPoseConfidence = poseResult.confidence;
            this.currentPoseStartTime = now;
            this.currentPoseCounted = false;
        } else {
            // Same pose continues
            this.lastPoseConfidence = poseResult.confidence;
            
            // If pose has been held long enough, count it
            if (this.currentPoseStartTime && (now - this.currentPoseStartTime >= this.poseSustainTime)) {
                // Only count if we haven't already counted this specific pose occurrence
                if (!this.currentPoseCounted) {
                    this.recordPose(poseResult.pose, poseResult.confidence);
                    this.currentPoseCounted = true;
                }
            }
        }
    }

    // Record a successfully held pose
    recordPose(poseName, confidence) {
        // Update pose stats
        this.poseStats.count++;
        this.poseStats.totalConfidence += confidence;
        
        if (confidence > this.poseStats.bestConfidence) {
            this.poseStats.bestConfidence = confidence;
            this.poseStats.bestPose = poseName;
        }
        
        // Add to detected poses array for history
        const poseTime = new Date().toLocaleTimeString();
        this.detectedPoses.push({
            name: poseName,
            confidence: confidence,
            time: poseTime,
            timestamp: Date.now()
        });
        
        // Call the external update function
        if (typeof updateSessionStats === 'function') {
            updateSessionStats(this.poseStats, this.detectedPoses);
        }
    }

    // Update the UI with pose detection results
    updatePoseUI(poseResult) {
        this.poseNameElement.textContent = poseResult.pose;
        const confidencePercent = Math.round(poseResult.confidence * 100);
        this.confidenceFill.style.width = `${confidencePercent}%`;
        this.confidenceText.textContent = `${confidencePercent}%`;
    }

    // Start the camera and pose detection
    async startCamera() {
        if (this.isRunning) return;
        
        if (!this.isModelLoaded) {
            const success = await this.setup();
            if (!success) return false;
        }
        
        try {
            // Hide the camera overlay
            document.getElementById('camera-overlay').style.display = 'none';
            
            // Initialize the camera
            this.camera = new Camera(this.video, {
                onFrame: async () => {
                    await this.pose.send({image: this.video});
                },
                width: 640,
                height: 480
            });
            
            // Start the camera
            await this.camera.start();
            this.isRunning = true;
            
            // Resize canvas to match video dimensions
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            
            return true;
        } catch (error) {
            console.error('Error starting camera:', error);
            alert('Error starting camera. Please check camera permissions and try again.');
            return false;
        }
    }

    // Stop the camera and pose detection
    stopCamera() {
        if (!this.isRunning) return;
        
        this.camera.stop();
        this.isRunning = false;
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Show the camera overlay
        document.getElementById('camera-overlay').style.display = 'flex';
    }

    // Start a new yoga session
    startSession() {
        this.sessionStartTime = Date.now();
        this.sessionActive = true;
        this.detectedPoses = [];
        this.poseStats = {
            count: 0,
            bestPose: null,
            bestConfidence: 0,
            totalConfidence: 0
        };
        this.currentPoseStartTime = null;
        this.lastDetectedPose = null;
        this.currentPoseCounted = false;
    }

    // End the current yoga session
    endSession() {
        this.sessionActive = false;
        return {
            duration: Date.now() - this.sessionStartTime,
            poses: this.detectedPoses,
            stats: this.poseStats
        };
    }

    // Helper methods for pose detection
    isBodyStraight(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        return Math.abs(leftShoulder.y - leftHip.y) > 0.2 && 
               Math.abs(rightShoulder.y - rightHip.y) > 0.2;
    }

    areArmsAtSides(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        
        return Math.abs(leftShoulder.x - leftWrist.x) < 0.15 &&
               Math.abs(rightShoulder.x - rightWrist.x) < 0.15;
    }

    areLegsStaight(landmarks) {
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        
        return Math.abs(leftHip.x - leftKnee.x) < 0.1 &&
               Math.abs(leftKnee.x - leftAnkle.x) < 0.1 &&
               Math.abs(rightHip.x - rightKnee.x) < 0.1 &&
               Math.abs(rightKnee.x - rightAnkle.x) < 0.1;
    }

    isLegBent(landmarks) {
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        
        return Math.abs(leftAnkle.y - rightAnkle.y) > 0.1;
    }

    areArmsRaised(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        
        return leftWrist.y < leftShoulder.y && rightWrist.y < rightShoulder.y;
    }

    areLegsSpread(landmarks) {
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        
        return Math.abs(leftAnkle.x - rightAnkle.x) > 0.3;
    }

    areArmsExtendedSides(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        
        return leftWrist.x < leftShoulder.x - 0.15 && 
               rightWrist.x > rightShoulder.x + 0.15;
    }

    isBodyBentSide(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        
        return Math.abs(leftShoulder.y - rightShoulder.y) > 0.15;
    }

    areArmsVertical(landmarks) {
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        
        return Math.abs(leftWrist.y - rightWrist.y) > 0.3;
    }

    isInvertedV(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        
        return (leftWrist.y > 0.7 && rightWrist.y > 0.7) && 
               (leftAnkle.y > 0.7 && rightAnkle.y > 0.7) && 
               (leftHip.y < 0.6 && rightHip.y < 0.6);
    }

    isCobraPose(landmarks) {
        const leftShoulder = landmarks[11];
        const rightShoulder = landmarks[12];
        const leftElbow = landmarks[13];
        const rightElbow = landmarks[14];
        const leftWrist = landmarks[15];
        const rightWrist = landmarks[16];
        
        return (leftElbow.y < leftShoulder.y) && (rightElbow.y < rightShoulder.y) &&
               (leftWrist.y < leftElbow.y) && (rightWrist.y < rightElbow.y);
    }

    areKneesBent(landmarks) {
        const leftHip = landmarks[23];
        const rightHip = landmarks[24];
        const leftKnee = landmarks[25];
        const rightKnee = landmarks[26];
        const leftAnkle = landmarks[27];
        const rightAnkle = landmarks[28];
        
        return Math.abs(leftKnee.y - leftHip.y) > 0.1 &&
               Math.abs(rightKnee.y - rightHip.y) > 0.1 &&
               Math.abs(leftKnee.y - leftAnkle.y) > 0.1 &&
               Math.abs(rightKnee.y - rightAnkle.y) > 0.1;
    }
}