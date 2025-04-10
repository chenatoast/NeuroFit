# NeuroFit - Your Daily Live Fitness Tracker

## Overview
NeuroFit uses artificial intelligence to detect and analyze yoga poses in real-time through your camera. The application identifies seven common yoga poses, tracks your performance, and stores session data in the cloud - all with a clean, modern interface that works on any device.

## Technology Stack & Tools
- **MediaPipe Pose (Google AI)**: Advanced machine learning framework that detects 33 body landmarks to analyze posture with high precision
- **TensorFlow.js**: Powers the real-time pose classification algorithms
- **Computer Vision**: Processes video frames for instant pose recognition
- **JavaScript/HTML5/CSS3**: Core web technologies for responsive interface
- **Canvas API**: Renders skeleton overlays with visual feedback
- **Firebase Firestore**: Cloud database for secure storage of session statistics
- **Firebase Authentication**: Manages user identity without registration requirements
- **Real-time Data Processing**: Analyzes body positioning at 30+ frames per second
- **Geometric Pattern Recognition**: Custom algorithms for pose identification

## Key Features
- Real-time detection of 7 yoga poses (Mountain, Tree, Warrior II, Triangle, Downward Dog, Cobra, Chair)
- Session tracking with time, pose counts, and confidence metrics
- Visual confidence meter showing pose accuracy
- Cloud storage of practice history
- Simple one-click operation to start/stop sessions
- Privacy-focused design (all processing happens locally)
