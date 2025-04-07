/**
 * Main application script
 * Handles UI updates and audio processor initialization
 */
document.addEventListener('DOMContentLoaded', () => {
    // Initialize variables and components
    const startButton = document.getElementById('start-button');
    const stopButton = document.getElementById('stop-button');
    const statusMessage = document.getElementById('status-message');
    let chordName = document.getElementById('chord-name');
    let chordType = document.getElementById('chord-type');
    let confidenceIndicator = document.getElementById('confidence-indicator');
    let volumeMeter = document.getElementById('volume-meter');
    
    // Audio processing components
    let audioProcessor = null;
    
    // Chord history system
    let recentChords = [];
    let maxRecentChords = 10;
    let pendingHistoryChord = null;
    let chordHistoryStability = 0;
    let lastDetectedChord = null;
    let lastHistoryAddTime = 0;
    
    // Audio processing parameters
    let minVolumeForChord = 0.01; // Extremely low threshold to detect even quieter playing
    
    // Initialize the audio processor
    async function initialize() {
        try {
            console.log("Initializing audio processor...");
            audioProcessor = new AudioProcessor();
            
            // Initialize audio context and set up analyzer nodes
            const initialized = await audioProcessor.initialize();
            
            if (!initialized) {
                updateStatus('Error initializing audio system. Please refresh and try again.');
                return false;
            }
            
            // Set callback for audio processing results
            audioProcessor.setAudioProcessedCallback(handleAudioProcessed);
            
            return true;
        } catch (error) {
            console.error("Error during initialization:", error);
            updateStatus('Failed to initialize audio system: ' + error.message);
            return false;
        }
    }
    
    // Handle audio processing results
    function handleAudioProcessed(results) {
        try {
            // Update the volume meter
            updateVolumeMeter(results.volume);
            
            // Ensure chord display is updated even for minor chords
            requestAnimationFrame(() => {
                // Direct DOM update outside normal flow
                document.getElementById("chord-name").textContent = results.chord.name || "...";
                document.getElementById("chord-type").textContent = results.chord.type || "Listening...";
            });
            
            // Detect chords when volume is above threshold
            if (results.chromagram && results.volume >= minVolumeForChord) {
                // Check if onset (new strum) was detected
                const wasNewStrum = results.onsetDetected || false;
                
                // Get the chord from detector
                updateChordDisplay(results.chord);
            } else if (results.volume < minVolumeForChord) {
                // No sound or too quiet
                // Clear the display after a moment of silence if needed
            }
        } catch (error) {
            console.error("Error processing audio results:", error);
        }
    }
    
    // Update the volume meter
    function updateVolumeMeter(volume) {
        if (!volumeMeter) {
            console.warn("Volume meter element not found");
            volumeMeter = document.getElementById('volume-meter');
            if (!volumeMeter) return;
        }
        
        // Convert to percentage and set the width
        const percentage = Math.min(100, Math.max(0, volume * 100 * 5)); // Scale up for better visibility
        volumeMeter.style.width = percentage + '%';
    }
    
    function updateChordDisplay(chord) {
        console.log(`Chord display update called with: ${chord.name} ${chord.type} (confidence: ${chord.confidence.toFixed(2)})`);
        
        // Always try to get fresh references to DOM elements in case they were lost
        if (!chordName) chordName = document.getElementById("chord-name");
        if (!chordType) chordType = document.getElementById("chord-type");
        if (!confidenceIndicator) confidenceIndicator = document.getElementById("confidence-indicator");
        
        // Only update if confidence is reasonable or it's a new chord
        if (chord.confidence > 0.15 || chord.name !== lastDetectedChord) {
            const chordNameText = chord.name;
            const chordTypeText = chord.type;
            
            // Check if this is a new chord
            if (chord.name !== lastDetectedChord && chord.name) {
                // Add animation class
                const chordDisplay = document.getElementById('chord-display');
                if (chordDisplay) {
                    chordDisplay.classList.remove('chord-changed');
                    void chordDisplay.offsetWidth; // Trigger reflow
                    chordDisplay.classList.add('chord-changed');
                }
                
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
            
            // Direct DOM updates with safety checks
            // Use requestAnimationFrame for smoother updates
            requestAnimationFrame(() => {
                if (chordName) {
                    chordName.textContent = chordNameText || '...';
                    console.log("Updated chord name display to:", chordNameText);
                } else {
                    console.error("Missing chord-name element");
                }
                
                if (chordType) {
                    chordType.textContent = chordTypeText || 'Listening...';
                    console.log("Updated chord type display to:", chordTypeText);
                } else {
                    console.error("Missing chord-type element");
                }
                
                // Update confidence indicator if it exists
                if (confidenceIndicator) {
                    // Update confidence indicator
                    if (chord.confidence > 0.6) {
                        confidenceIndicator.className = 'confidence-indicator confidence-high';
                    } else if (chord.confidence > 0.3) {
                        confidenceIndicator.className = 'confidence-indicator confidence-medium';
                    } else {
                        confidenceIndicator.className = 'confidence-indicator confidence-low';
                    }
                } else {
                    console.error("Missing confidence indicator element");
                }
            });
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
        
        // Limit the history size
        if (recentChords.length > maxRecentChords) {
            recentChords.shift();
        }
        
        // Update the UI
        updateChordHistory();
    }
    
    // More complex version with stability checks
    function addChordToHistory(chord) {
        if (chord.name === pendingHistoryChord) {
            chordHistoryStability++;
            
            // Only add to history if we've seen this chord consistently
            if (chordHistoryStability >= 3) {
                console.log(`Adding stable chord to history: ${chord.name} ${chord.type}`);
                
                // Check if it's different from the last chord in history
                if (recentChords.length === 0 || 
                    recentChords[recentChords.length-1].name !== chord.name) {
                    
                    // Add the chord to history
                    recentChords.push({
                        name: chord.name,
                        type: chord.type
                    });
                    
                    // Limit the history size
                    if (recentChords.length > maxRecentChords) {
                        recentChords.shift();
                    }
                    
                    // Reset stability counter after adding
                    chordHistoryStability = 0;
                    pendingHistoryChord = null;
                    
                    // Update the UI
                    updateChordHistory();
                }
            }
        } else {
            // Different chord, reset stability
            pendingHistoryChord = chord.name;
            chordHistoryStability = 1;
        }
    }
    
    // Update the chord history display
    function updateChordHistory() {
        const chordHistoryElement = document.getElementById('chord-history');
        if (!chordHistoryElement) {
            console.error("Chord history element not found");
            return;
        }
        
        // Clear the current history display
        chordHistoryElement.innerHTML = '';
        
        // Add each chord to the display
        recentChords.forEach(chord => {
            const chordElement = document.createElement('div');
            chordElement.className = 'chord-history-item';
            chordElement.textContent = `${chord.name}${chord.type}`;
            chordHistoryElement.appendChild(chordElement);
        });
        
        if (recentChords.length === 0) {
            // Show placeholder if no chords yet
            const placeholder = document.createElement('div');
            placeholder.className = 'text-muted';
            placeholder.textContent = 'Chords you play will appear here';
            chordHistoryElement.appendChild(placeholder);
        }
    }
    
    // Update the status message
    function updateStatus(message) {
        if (statusMessage) {
            statusMessage.textContent = message;
        }
    }
    
    // Start listening for audio
    async function startListening() {
        try {
            updateStatus('Starting audio processing...');
            
            // Initialize if not already done
            if (!audioProcessor) {
                const initialized = await initialize();
                if (!initialized) {
                    return;
                }
            }
            
            // Set up audio
            const setupSuccess = await audioProcessor.setupAudio();
            if (!setupSuccess) {
                updateStatus('Failed to access microphone. Please check permissions.');
                return;
            }
            
            // Start processing audio
            audioProcessor.start();
            
            // Update UI
            startButton.disabled = true;
            stopButton.disabled = false;
            updateStatus('Listening for guitar chords... Play something!');
            
            // Make sure the chord display is reset
            chordName.textContent = '...';
            chordType.textContent = 'Listening...';
            
        } catch (error) {
            console.error("Error starting audio:", error);
            updateStatus('Error: ' + error.message);
        }
    }
    
    // Stop listening for audio
    function stopListening() {
        try {
            if (audioProcessor) {
                audioProcessor.stop();
            }
            
            // Update UI
            startButton.disabled = false;
            stopButton.disabled = true;
            updateStatus('Stopped listening. Click "Start Listening" to begin again.');
            
        } catch (error) {
            console.error("Error stopping audio:", error);
            updateStatus('Error: ' + error.message);
        }
    }
    
    // Add event listeners to buttons
    startButton.addEventListener('click', startListening);
    stopButton.addEventListener('click', stopListening);
    
    // Pre-initialize the audio processor when page loads
    // This creates the audio context but doesn't request microphone access yet
    initialize().then(success => {
        if (success) {
            updateStatus('Ready to listen! Click "Start Listening" to begin.');
        }
    });
});
