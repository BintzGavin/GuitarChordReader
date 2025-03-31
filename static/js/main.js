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
        
        const success = await audioProcessor.initialize();
        
        if (!success) {
            updateStatus('Failed to initialize audio. Please check microphone permissions.');
            return false;
        }
        
        // Set up callback for audio processing results
        audioProcessor.setAudioProcessedCallback(handleAudioProcessed);
        
        updateStatus('Ready! Click "Start Listening" to begin chord detection.');
        return true;
    }
    
    // Handle audio processing results with attack detection
    function handleAudioProcessed(results) {
        // Debug logging to see what data we're getting
        console.log(`Volume: ${results.volume.toFixed(2)}, Chord: ${results.chord ? results.chord.name : 'none'}, Confidence: ${results.chord ? results.chord.confidence.toFixed(2) : 0}`);
        
        // Update volume meter
        updateVolumeMeter(results.volume);
        
        // Initialize attack detection state if not already
        if (typeof lastAttackTime === 'undefined') {
            lastAttackTime = 0;
            strumInProgress = false;
            requiredStableFrames = 6; // Reduced from 10
            stableFrameThreshold = { // By chord name - all reduced
                'E': 5,    // Easier to detect (reduced from 7)
                'Em': 4,   // Even easier (reduced from 6)
                'G': 5,    // Easier (reduced from 7)
                'F': 8,    // Still harder but reduced from 14
                'default': 6  // Reduced from 10
            };
            
            // Keep track of last few chords detected (raw, not in history)
            // This helps detect stable patterns vs. noise
            lastChordBuffer = [];
            lastChordBufferSize = 8;
            
            // Track activity/decay state
            lastActiveTime = 0;
            activityTimeout = 1500; // Reduced from 2000ms - shorter time before decay 
            lastVolumeActivity = 0;
            volumeActivityThreshold = 0.15; // Reduced from 0.2 - lower threshold for "activity"
            
            // Noise control
            minVolumeForChord = 0.08; // Reduced from 0.12 - less strict minimum volume
            inNoiseHandlingMode = false; // Special noise handling active

            // Create a map to track rejected chords
            chordRejections = {};            
        }
        
        // SECTION 1: VOLUME ACTIVITY DETECTION
        const now = Date.now();
        
        // Check for significant volume activity
        if (results.volume > volumeActivityThreshold) {
            // Update activity time
            lastActiveTime = now;
            lastVolumeActivity = results.volume;
            
            // When we have new activity after inactivity, reset stability
            if (now - lastAttackTime > 500) {
                // Possible new strum if we've been quiet
                strumInProgress = true;
                lastAttackTime = now;
                chordHistoryStability = 0;
                
                // Clear the recent chord buffer on new strums
                lastChordBuffer = [];
            }
        }
        
        // SECTION 2: CHORD DETECTION
        if (results.chord && results.chord.name) {
            // Only process when there's reasonable volume
            // This is our first major noise gate
            if (results.volume < minVolumeForChord) {
                // Volume too low for chord detection
                return;
            }
            
            // Add detected chord to our buffer
            if (lastChordBuffer.length >= lastChordBufferSize) {
                lastChordBuffer.shift();
            }
            lastChordBuffer.push({
                name: results.chord.name,
                type: results.chord.type,
                confidence: results.chord.confidence,
                timestamp: now
            });
            
            // Update the display immediately
            updateChordDisplay(results.chord);
            
            // SECTION 3: CHORD STABILITY ANALYSIS
            // Only consider adding to history if we have enough data
            if (lastChordBuffer.length >= 4) {
                // Get most recent chord
                const recentChord = results.chord.name;
                
                // Count how many of the last several frames show this same chord
                const countSameChord = lastChordBuffer.filter(c => c.name === recentChord).length;
                
                // Calculate what percentage of recent detections are this chord
                const percentSameChord = countSameChord / lastChordBuffer.length;
                
                // Check if we're seeing a relatively stable chord pattern (>60% same chord - reduced from 70%)
                if (percentSameChord > 0.6) {
                    // We have a relatively stable chord, but we need additional checks
                    
                    // Check if this chord has been rejected too many times recently
                    const rejectionCount = chordRejections[recentChord] || 0;
                    if (rejectionCount > 3) {
                        // This chord is being rejected repeatedly
                        // It might be persistent noise - increase threshold
                        minVolumeForChord = Math.min(0.25, minVolumeForChord * 1.05);
                        
                        // Skip further processing
                        return;
                    }
                    
                    // Get specific stable frame requirement for this chord
                    const framesRequired = stableFrameThreshold[recentChord] || 
                                         stableFrameThreshold.default;
                    
                    // If same as pending chord, increment stability
                    if (recentChord === pendingHistoryChord) {
                        chordHistoryStability++;
                        
                        // If we've been stable long enough, add to history
                        if (chordHistoryStability >= framesRequired && 
                            results.chord.confidence > 0.2) { // Reduced confidence requirement from 0.3 to 0.2
                            
                            // Special handler for F chord - check if we're seeing
                            // too many Fs - if yes, reject this detection
                            if (recentChord === 'F' && 
                                recentChords.filter(c => c.name === 'F').length > 1) {
                                
                                // Too many F chords already - likely false detection
                                chordRejections['F'] = (chordRejections['F'] || 0) + 1;
                                pendingHistoryChord = null;
                                return;
                            }
                            
                            // Add chord to history
                            addChordToHistory(results.chord);
                            
                            // Reset tracking
                            chordHistoryStability = 0;
                            pendingHistoryChord = null;
                            
                            // Reset rejections for this chord
                            chordRejections[recentChord] = 0;
                        }
                    } else {
                        // New chord detected, reset stability
                        pendingHistoryChord = recentChord;
                        chordHistoryStability = 1;
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
                    'F': 0.45, // Still higher threshold for F to prevent false detections
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
            chordElement.textContent = chord.name + (chord.type === 'Minor' ? 'm' : '');
            
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
        // Setup audio after user gesture (browser requirement)
        if (!audioProcessor.analyser) {
            updateStatus('Setting up audio, please wait...');
            const setupSuccess = await audioProcessor.setupAudio();
            if (!setupSuccess) {
                updateStatus('Failed to access microphone. Please check permissions and try again.');
                return;
            }
        }
        
        audioProcessor.start();
        startButton.disabled = true;
        stopButton.disabled = false;
        updateStatus('Listening for chords...');
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
