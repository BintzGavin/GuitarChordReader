/**
 * Main application script
 * Handles UI updates and audio processor initialization
 */
document.addEventListener('DOMContentLoaded', function() {
    // DOM elements
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const chordName = document.getElementById('chord-name');
    const chordType = document.getElementById('chord-type');
    const confidenceIndicator = document.getElementById('confidence-indicator');
    const volumeMeter = document.getElementById('volume-meter');
    const statusMessage = document.getElementById('status-message');
    const chordHistory = document.getElementById('chord-history');
    
    // Create audio processor
    const audioProcessor = new AudioProcessor();
    
    // Track the last few detected chords
    const recentChords = [];
    const maxHistoryLength = 6; // Maximum number of chords to show in history
    let lastDetectedChord = '';
    
    // Stability tracking for chord history
    let chordHistoryStability = 0;
    const chordHistoryThreshold = 5; // Reduced from 8 - fewer consecutive frames required
    let pendingHistoryChord = null;
    let lastHistoryAddTime = 0; // Track when we last added a chord to history
    
    // Initialize the application
    async function initialize() {
        updateStatus('Initializing audio system...');
        console.log("Starting application initialization...");
        
        try {
            // Initialize the audio processor with better error handling
            console.log("Initializing AudioProcessor...");
            const success = await audioProcessor.initialize().catch(error => {
                console.error("Error during AudioProcessor initialization:", error);
                return false;
            });
            
            if (!success) {
                console.error("AudioProcessor initialization failed");
                updateStatus('Failed to initialize audio. Please check microphone permissions or try refreshing the page.');
                return false;
            }
            
            console.log("AudioProcessor initialized successfully");
            
            // Set up callback for audio processing results
            console.log("Setting up audio processing callback...");
            try {
                audioProcessor.setAudioProcessedCallback(handleAudioProcessed);
                console.log("Audio processing callback set up successfully");
            } catch (callbackError) {
                console.error("Error setting up audio processing callback:", callbackError);
                updateStatus('Error setting up audio processor. Please refresh and try again.');
                return false;
            }
            
            console.log("Application initialization complete!");
            updateStatus('Ready! Click "Start Listening" to begin chord detection.');
            return true;
        } catch (error) {
            console.error('Unexpected error during initialization:', error);
            updateStatus('Error initializing audio system. Please try using a different browser.');
            return false;
        }
    }
    
    // Handle audio processing results with advanced detection
    function handleAudioProcessed(results) {
        // Debug logging to see what data we're getting
        console.log(`Volume: ${results.volume.toFixed(2)}, Chord: ${results.chord ? results.chord.name : 'none'}, Confidence: ${results.chord ? results.chord.confidence.toFixed(2) : 0}, NewStrum: ${results.isNewStrum ? 'yes' : 'no'}`);
        
        // Update volume meter
        updateVolumeMeter(results.volume);
        
        // Initialize detection state if not already
        if (typeof lastAttackTime === 'undefined') {
            lastAttackTime = 0;
            strumInProgress = false;
            requiredStableFrames = 5; // Further reduced with better detection
            stableFrameThreshold = { // By chord name - optimized with the new detection
                'E': 4,    // Easier with improved detection
                'Em': 3,   // Even easier with improved detection
                'G': 4,    // Easier with improved detection
                'F': 6,    // More reasonable with improved detection
                'default': 5  // Reduced with improved detection
            };
            
            // Keep track of last few chords detected (raw, not in history)
            // This helps detect stable patterns vs. noise
            lastChordBuffer = [];
            lastChordBufferSize = 7; // Reduced buffer size for faster response
            
            // Track activity/decay state
            lastActiveTime = 0;
            activityTimeout = 1200; // Further reduced - shorter decay with improved detection
            lastVolumeActivity = 0;
            volumeActivityThreshold = 0.12; // Lower threshold with better noise handling
            
            // Noise control
            minVolumeForChord = 0.06; // Lower threshold with better noise filtering
            inNoiseHandlingMode = false; // Special noise handling active

            // Create a map to track rejected chords
            chordRejections = {};            
        }
        
        // SECTION 1: VOLUME & ONSET DETECTION
        const now = Date.now();
        
        // Check for significant volume activity
        if (results.volume > volumeActivityThreshold) {
            // Update activity time
            lastActiveTime = now;
            lastVolumeActivity = results.volume;
        }
        
        // Use the superior onset detection from our enhanced audio processor
        // which combines spectral flux and energy analysis
        const isNewStrum = results.isNewStrum || false;
        
        // When the audio processor detects a new strum/attack, reset stability
        if (isNewStrum) {
            strumInProgress = true;
            lastAttackTime = now;
            chordHistoryStability = 0;
            
            // Clear the recent chord buffer on new strums for fresh detection
            lastChordBuffer = [];
        }
        
        // SECTION 2: ADVANCED CHORD DETECTION
        if (results.chromagram && results.volume >= minVolumeForChord) {
            // We have a chromagram but no chord - use our detector with the latest advanced logic
            // This path is not used currently but allows for future separation of chromagram extraction
            // from chord detection if needed
        }
        else if (results.chord && results.chord.name) {
            // Only process when there's reasonable volume
            // This is our first major noise gate
            if (results.volume < minVolumeForChord) {
                // Volume too low for chord detection
                return;
            }
            
            // Add detected chord to our buffer with additional metadata
            if (lastChordBuffer.length >= lastChordBufferSize) {
                lastChordBuffer.shift();
            }
            lastChordBuffer.push({
                name: results.chord.name,
                type: results.chord.type,
                confidence: results.chord.confidence,
                isStable: results.chord.isStable || false,
                isNewStrum: isNewStrum,
                timestamp: now
            });
            
            // Update the display immediately for responsive UI
            updateChordDisplay(results.chord);
            
            // SECTION 3: CHORD STABILITY ANALYSIS WITH IMPROVED LOGIC
            // Only consider adding to history if we have enough data or if we have a highly confident detection
            // with a new strum detected
            if (lastChordBuffer.length >= 3 || (isNewStrum && results.chord.confidence > 0.6)) {
                // Get most recent chord
                const recentChord = results.chord.name;
                
                // Count how many of the last several frames show this same chord
                const countSameChord = lastChordBuffer.filter(c => c.name === recentChord).length;
                
                // Calculate what percentage of recent detections are this chord
                const percentSameChord = countSameChord / Math.max(1, lastChordBuffer.length);
                
                // Check if we're seeing a stable chord pattern (adaptive threshold)
                // Lower threshold when a new strum is detected (faster response)
                const stabilityThreshold = isNewStrum ? 0.5 : 0.6;
                
                if (percentSameChord > stabilityThreshold || results.chord.isStable) {
                    // We have a relatively stable chord, but we need additional validation
                    
                    // Check if this chord has been rejected too many times recently
                    const rejectionCount = chordRejections[recentChord] || 0;
                    if (rejectionCount > 3) {
                        // This chord has been rejected multiple times - skip it
                        return;
                    }
                    
                    // Get specific stable frame requirement, reduced when we detect a new strum
                    let framesRequired = stableFrameThreshold[recentChord] || 
                                      stableFrameThreshold.default;
                    
                    // If we have a new strum, lower the required frames for faster response
                    if (isNewStrum) {
                        framesRequired = Math.max(2, Math.floor(framesRequired * 0.6));
                    }
                    
                    // If same as pending chord, increment stability
                    if (recentChord === pendingHistoryChord) {
                        chordHistoryStability++;
                        
                        // If we've been stable long enough or have a very confident detection with new strum, add to history
                        const confidentNewStrumDetection = isNewStrum && 
                                                        results.chord.confidence > 0.55 && 
                                                        chordHistoryStability >= 1;
                        
                        const stableDetection = chordHistoryStability >= framesRequired && 
                                             results.chord.confidence > 0.2;
                            
                        if (stableDetection || confidentNewStrumDetection) {
                            // Special handler for problematic chords
                            if ((recentChord === 'F' || recentChord === 'Fmaj7') && 
                                recentChords.filter(c => c.name === recentChord).length > 1) {
                                
                                // Too many already in history - likely false detection
                                chordRejections[recentChord] = (chordRejections[recentChord] || 0) + 1;
                                pendingHistoryChord = null;
                                return;
                            }
                            
                            // Add chord to history with enhanced metadata
                            addChordToHistory({
                                name: results.chord.name,
                                type: results.chord.type,
                                confidence: results.chord.confidence,
                                isStable: results.chord.isStable || false,
                                timestamp: now,
                                fromNewStrum: isNewStrum
                            });
                            
                            // Reset tracking
                            chordHistoryStability = 0;
                            pendingHistoryChord = null;
                            
                            // Reset rejections for this chord
                            chordRejections[recentChord] = 0;
                        }
                    } else {
                        // New chord detected, reset stability with bonus for new strums
                        pendingHistoryChord = recentChord;
                        chordHistoryStability = isNewStrum ? 1 : 0;
                    }
                }
            }
        } else {
            // No chord detected
            if (lastDetectedChord) {
                chordName.textContent = '...';
                chordType.textContent = 'Listening...';
                confidenceIndicator.className = 'confidence-indicator';
                lastDetectedChord = '';
                pendingHistoryChord = null;
                chordHistoryStability = 0;
            }
            
            // Decay our chord display after period of inactivity
            const inactiveTime = now - lastActiveTime;
            if (inactiveTime > activityTimeout) {
                // We've been inactive for a while - reset everything
                strumInProgress = false;
                lastChordBuffer = [];
                chordHistoryStability = 0;
            }
        }
    }
    
    // Update the volume meter
    function updateVolumeMeter(volume) {
        // Convert volume (0-1) to percentage
        const percentage = Math.min(100, Math.round(volume * 100));
        volumeMeter.style.width = `${percentage}%`;
        
        // Add color classes based on volume
        if (percentage > 80) {
            volumeMeter.classList.add('bg-danger');
            volumeMeter.classList.remove('bg-warning', 'bg-success');
        } else if (percentage > 40) {
            volumeMeter.classList.add('bg-warning');
            volumeMeter.classList.remove('bg-danger', 'bg-success');
        } else {
            volumeMeter.classList.add('bg-success');
            volumeMeter.classList.remove('bg-danger', 'bg-warning');
        }
    }
    
    // Update the chord display
    function updateChordDisplay(chord) {
        // Only update if confidence is reasonable or it's a new chord
        if (chord.confidence > 0.2 || chord.name !== lastDetectedChord) {
            const chordNameText = chord.name;
            const chordTypeText = chord.type;
            
            // Check if this is a new chord
            if (chord.name !== lastDetectedChord && chord.name) {
                // Add animation class
                const chordDisplay = document.getElementById('chord-display');
                chordDisplay.classList.remove('chord-changed');
                void chordDisplay.offsetWidth; // Trigger reflow
                chordDisplay.classList.add('chord-changed');
                
                console.log("New chord detected:", chord.name, "with confidence", chord.confidence.toFixed(2));
                
                // SIMPLIFIED APPROACH: Directly add new chords to history with minimal filtering
                // Only if different from last chord and reasonable confidence
                if (chord.confidence > 0.4) {
                    // Check if it's different from the last chord in history
                    const isNewInHistory = recentChords.length === 0 || 
                                         recentChords[recentChords.length-1].name !== chord.name;
                    
                    // Ensure we don't add too frequently
                    const now = Date.now();
                    const timeSinceLastAdd = now - lastHistoryAddTime;
                    
                    if (isNewInHistory && timeSinceLastAdd > 800) {
                        console.log("Adding to history:", chord.name);
                        // Directly add to history with minimal filtering
                        addChordToHistorySimple(chord);
                    }
                }
                
                // Keep tracking for the complex system too
                if (pendingHistoryChord !== chord.name) {
                    pendingHistoryChord = chord.name;
                    chordHistoryStability = 0;
                }
                
                lastDetectedChord = chord.name;
            }
            
            // Update display text
            chordName.textContent = chordNameText || '...';
            chordType.textContent = chordTypeText || 'Listening...';
            
            // Update confidence indicator
            if (chord.confidence > 0.6) {
                confidenceIndicator.className = 'confidence-indicator confidence-high';
            } else if (chord.confidence > 0.3) {
                confidenceIndicator.className = 'confidence-indicator confidence-medium';
            } else {
                confidenceIndicator.className = 'confidence-indicator confidence-low';
            }
        }
    }
    
    // Simplified version of addChordToHistory with minimal filtering
    function addChordToHistorySimple(chord) {
        // Just add the chord to history with minimal checks
        recentChords.push({
            name: chord.name,
            type: chord.type
        });
        
        // Update the timestamp
        lastHistoryAddTime = Date.now();
        
        // Limit history length
        if (recentChords.length > maxHistoryLength) {
            recentChords.shift();
        }
        
        // Update history display
        updateChordHistory();
        
        // Log
        console.log("ADDED TO HISTORY:", chord.name);
        console.log("Current chords in history:", recentChords.map(c => c.name));
    }
    
    // Add a chord to the history display with much stronger debouncing
    function addChordToHistory(chord) {
        // Initialize state tracking for multiple-detection prevention
        if (!window.chordHistoryState) {
            window.chordHistoryState = {
                chordCounts: {}, // Track how many times we've seen each chord recently
                lastStrumTime: 0, // Track when the last strum happened
                minTimeBetweenStrums: 800, // Minimum ms between different strums (reduced from 1500ms)
                chordLockoutTime: 1500,  // How long to prevent repeating the same chord (reduced from 3000ms)
                chordConfidenceThresholds: { // Min confidence to add to history by chord (reduced thresholds)
                    'E': 0.3,
                    'Em': 0.25, 
                    'G': 0.3,
                    'D': 0.3, // Threshold for D major
                    'Dm': 0.28, // Lower threshold for Dm
                    'F': 0.45, // Still higher threshold for F to prevent false detections
                    'Fmaj7': 0.35, // Threshold for Fmaj7
                    'default': 0.35
                },
                lastChordsByName: {} // Last time we added each chord by name
            };
        }
        
        const state = window.chordHistoryState;
        const currentTime = Date.now();
        
        // 1. Skip if the same as the last chord in history
        if (recentChords.length > 0 && recentChords[recentChords.length - 1].name === chord.name) {
            return;
        }
        
        // 2. Skip if this chord was added too recently (avoid duplicates even if chord changes between)
        const lastTimeForThisChord = state.lastChordsByName[chord.name] || 0;
        if (currentTime - lastTimeForThisChord < state.chordLockoutTime) {
            return; // This chord is still locked out
        }
        
        // 3. Global time-based debounce - increase the minimum time dramatically
        if (currentTime - lastHistoryAddTime < state.minTimeBetweenStrums) {
            // Too soon after any chord was added - likely still the same strum
            return;
        }
        
        // 4. Check confidence threshold based on chord type
        const minConfidence = state.chordConfidenceThresholds[chord.name] || 
                            state.chordConfidenceThresholds.default;
        
        if (chord.confidence < minConfidence) {
            return; // Not confident enough for this chord
        }
        
        // If we get here, add the chord to history
        recentChords.push({
            name: chord.name,
            type: chord.type
        });
        
        // Update tracking state
        state.lastChordsByName[chord.name] = currentTime;
        lastHistoryAddTime = currentTime;
        
        // Limit history length
        if (recentChords.length > maxHistoryLength) {
            recentChords.shift();
        }
        
        // Update history display
        updateChordHistory();
        
        // Log detection for debugging
        console.log(`Added ${chord.name} to history with confidence ${chord.confidence.toFixed(2)}`);
        // Add additional debug logging to help diagnose issues
        console.log("Current chords in history:", recentChords.map(c => c.name));
    }
    
    // Update the chord history display
    function updateChordHistory() {
        console.log("updateChordHistory called, chords to display:", recentChords);
        
        // Make sure we have a valid reference to the chord history element
        if (!chordHistory) {
            console.error("Chord history DOM element not found!");
            chordHistory = document.getElementById('chord-history');
            if (!chordHistory) {
                console.error("Still can't find #chord-history element!");
                return;
            }
        }
        
        // Clear existing history
        chordHistory.innerHTML = '';
        
        if (recentChords.length === 0) {
            console.log("No chords in history to display");
            // Add a placeholder message when empty
            const emptyElement = document.createElement('div');
            emptyElement.className = 'chord-history-empty';
            emptyElement.textContent = 'No chords played yet';
            emptyElement.style.opacity = 0.5;
            chordHistory.appendChild(emptyElement);
            return;
        }
        
        // Debug what we're about to show
        console.log(`Displaying ${recentChords.length} chords in history`);
        
        // Add each chord to the display
        recentChords.forEach((chord, index) => {
            const chordElement = document.createElement('div');
            chordElement.className = 'chord-history-item';
            
            // Display chord name with appropriate suffix based on type
            if (chord.type === 'Minor') {
                chordElement.textContent = chord.name + 'm';
            } else if (chord.type === 'Major 7') {
                chordElement.textContent = chord.name + 'maj7';
            } else {
                chordElement.textContent = chord.name;
            }
            
            // Add opacity based on position (newer chords are more opaque)
            const opacity = 0.5 + (index / recentChords.length) * 0.5;
            chordElement.style.opacity = opacity;
            
            chordHistory.appendChild(chordElement);
            console.log(`Added ${chord.name} to history display`);
        });
    }
    
    // Update status message
    function updateStatus(message) {
        statusMessage.textContent = message;
    }
    
    // Start listening for chords
    async function startListening() {
        try {
            // First make sure we disable the button to prevent multiple clicks
            startButton.disabled = true;
            updateStatus('Setting up audio, please wait...');
            
            // Setup audio after user gesture (browser requirement)
            if (!audioProcessor.analyser) {
                console.log("Setting up audio system for the first time...");
                
                // This is the key operation that might fail if microphone access is denied
                const setupSuccess = await audioProcessor.setupAudio().catch(error => {
                    console.error("Error during setupAudio:", error);
                    return false;
                });
                
                if (!setupSuccess) {
                    console.error("Audio setup failed");
                    updateStatus('Failed to access microphone. Please check permissions and try again.');
                    startButton.disabled = false; // Re-enable button
                    return;
                }
                console.log("Audio setup completed successfully");
            } else {
                console.log("Audio system already set up, resuming");
            }
            
            // Start the audio processing
            try {
                audioProcessor.start();
                console.log("Audio processing started");
                stopButton.disabled = false;
                updateStatus('Listening for chords...');
            } catch (startError) {
                console.error("Error starting audio processor:", startError);
                updateStatus('Error starting audio system. Please refresh and try again.');
                startButton.disabled = false; // Re-enable button
            }
        } catch (error) {
            console.error("Unexpected error in startListening:", error);
            updateStatus('An unexpected error occurred. Please refresh the page and try again.');
            startButton.disabled = false; // Re-enable button
        }
    }
    
    // Stop listening for chords
    function stopListening() {
        audioProcessor.stop();
        startButton.disabled = false;
        stopButton.disabled = true;
        updateStatus('Stopped. Click "Start Listening" to begin again.');
    }
    
    // Event listeners
    startButton.addEventListener('click', async function() {
        if (!audioProcessor.isInitialized) {
            const initialized = await initialize();
            if (!initialized) return;
        }
        startListening();
    });
    
    stopButton.addEventListener('click', function() {
        stopListening();
    });
    
    // Handle page visibility changes (pause when tab is not visible)
    document.addEventListener('visibilitychange', function() {
        if (document.hidden && audioProcessor.isRunning) {
            audioProcessor.stop();
            updateStatus('Processing paused (page not visible)');
        } else if (!document.hidden && audioProcessor.isInitialized && !audioProcessor.isRunning) {
            audioProcessor.resume();
            updateStatus('Listening for chords...');
        }
    });
    
    // Initialize on page load
    initialize();
});
