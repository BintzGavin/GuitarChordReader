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
    
    // Handle audio processing results
    function handleAudioProcessed(results) {
        // Update volume meter
        updateVolumeMeter(results.volume);
        
        // Log debug information
        console.log("Volume:", results.volume.toFixed(4), 
                    "Chord:", results.chord.name, 
                    "Type:", results.chord.type,
                    "Confidence:", results.chord.confidence.toFixed(4),
                    "Stable:", results.chord.isStable);
        
        // Update chord display if a chord is detected
        if (results.chord && results.chord.name) {
            updateChordDisplay(results.chord);
        } else {
            // If no chord detected, show waiting message
            if (lastDetectedChord) {
                chordName.textContent = '...';
                chordType.textContent = 'Listening...';
                confidenceIndicator.className = 'confidence-indicator';
                lastDetectedChord = '';
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
                
                // Add to history if it's a valid chord (lower threshold for history)
                if (chord.confidence > 0.2 && chord.name) {
                    console.log("Adding chord to history:", chord.name, chord.type, "confidence:", chord.confidence.toFixed(4));
                    addChordToHistory(chord);
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
    
    // Add a chord to the history display
    function addChordToHistory(chord) {
        // Only add if it's not the same as the last one in history
        if (recentChords.length > 0 && recentChords[recentChords.length - 1].name === chord.name) {
            return;
        }
        
        // Add chord to recent chords array
        recentChords.push({
            name: chord.name,
            type: chord.type
        });
        
        // Limit history length
        if (recentChords.length > maxHistoryLength) {
            recentChords.shift();
        }
        
        // Update history display
        updateChordHistory();
    }
    
    // Update the chord history display
    function updateChordHistory() {
        // Clear the history display
        chordHistory.innerHTML = '';
        
        // Log the current chord history
        console.log("Current chord history:", recentChords.map(c => c.name + (c.type === 'Minor' ? 'm' : '')).join(', '));
        
        // Create elements for each chord in history
        recentChords.forEach((chord, index) => {
            const chordElement = document.createElement('div');
            chordElement.className = 'chord-history-item';
            
            // Format the chord name with minor indicator if needed
            const displayText = chord.name + (chord.type === 'Minor' ? 'm' : '');
            chordElement.textContent = displayText;
            
            // Give most recent chords stronger styling
            if (index === recentChords.length - 1) {
                chordElement.classList.add('most-recent');
            }
            
            // Add opacity based on position (newer chords are more opaque)
            const opacity = 0.6 + (index / recentChords.length) * 0.4;
            chordElement.style.opacity = opacity;
            
            // Add the chord element to the history container
            chordHistory.appendChild(chordElement);
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
