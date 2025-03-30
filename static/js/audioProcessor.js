/**
 * Audio Processor
 * Handles microphone audio capture and processing
 */
class AudioProcessor {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.javascriptNode = null;
        this.chordDetector = null;
        this.isInitialized = false;
        this.isRunning = false;
        this.processorNode = null;

        // Buffer for frequency data
        this.fftSize = 4096; // Larger FFT size for better frequency resolution
        this.bufferLength = 0;
        this.frequencyData = null;
        this.timeData = null;
    }

    /**
     * Initialize the audio context and request microphone access
     */
    async initialize() {
        try {
            // Create audio context but don't start it yet - it will start on user gesture
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                latencyHint: 'interactive',
                sampleRate: 44100
            });
            
            // Create the chord detector
            this.chordDetector = new ChordDetector();
            
            // Setup basic components - we'll connect them when user clicks start
            this.isInitialized = true;
            return true;
        } catch (error) {
            console.error('Error initializing audio processor:', error);
            return false;
        }
    }
    
    /**
     * Request microphone access and setup audio nodes
     * This must be called after a user gesture (like button click)
     */
    async setupAudio() {
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                } 
            });
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            
            // Create analyzer node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.8;
            this.bufferLength = this.analyser.frequencyBinCount;
            this.frequencyData = new Uint8Array(this.bufferLength);
            this.timeData = new Float32Array(this.fftSize);
            
            // Connect microphone to analyzer
            this.microphone.connect(this.analyser);
            
            // For simplicity in the initial implementation, we'll use the analyzer directly
            // The audio worklet can be added later for more advanced processing
            
            // To ensure we have a minimal viable product first, we're skipping the worklet
            // and using the analyzer node data directly for chord detection
            return true;
        } catch (error) {
            console.error('Error setting up audio:', error);
            return false;
        }
    }

    /**
     * Start audio processing
     */
    start() {
        if (!this.isInitialized) {
            throw new Error('Audio processor not initialized');
        }

        this.isRunning = true;
        this.processAudio();
    }

    /**
     * Stop audio processing
     */
    stop() {
        this.isRunning = false;
        if (this.audioContext && this.audioContext.state === 'running') {
            this.audioContext.suspend();
        }
    }

    /**
     * Resume audio processing
     */
    resume() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
        this.isRunning = true;
    }

    /**
     * Process audio data from the microphone with advanced noise handling
     */
    processAudio() {
        if (!this.isRunning) return;

        // Ensure the audio context is running
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Get time domain data
        this.analyser.getFloatTimeDomainData(this.timeData);
        
        // Get frequency data
        this.analyser.getByteFrequencyData(this.frequencyData);
        
        // Calculate volume level with noise gating
        const volume = this.calculateVolume();
        
        // Initialize settings if first run
        if (!this.audioSettings) {
            this.audioSettings = {
                // Hysteresis to prevent rapid on/off flickering around threshold
                silenceThreshold: 0.08,  // Min volume to process
                silenceHysteresis: 0.03, // Additional headroom before turning off
                silenceCounter: 0,       // Counter for silence frames
                silenceFramesRequired: 10, // Frames of silence before stopping chord detection
                isActive: false,         // Currently in an active audio state
                volumeHistory: [],       // Track volume changes
                volumeHistorySize: 20,   // How many frames to track
                significantVolumeChange: 0.15, // What's considered a significant volume change
                lastSignificantChange: 0,  // When was the last big volume change
                minTimeBetweenStrums: 300, // ms between strums
                lastProcessedTime: 0     // When we last processed audio
            };
        }
        
        const settings = this.audioSettings;
        const now = Date.now();
        
        // Update volume history
        settings.volumeHistory.push(volume);
        if (settings.volumeHistory.length > settings.volumeHistorySize) {
            settings.volumeHistory.shift();
        }
        
        // Decide if we should process audio based on volume
        let shouldProcess = false;
        
        if (volume >= settings.silenceThreshold) {
            // Volume above threshold, audio is active
            settings.isActive = true;
            settings.silenceCounter = 0;
            shouldProcess = true;
            
            // Check for significant volume changes (potential new strums)
            if (settings.volumeHistory.length > 5) {
                // Calculate average of previous few frames
                const prevVolumes = settings.volumeHistory.slice(0, -1).slice(-5);
                const avgPrevVolume = prevVolumes.reduce((a, b) => a + b, 0) / prevVolumes.length;
                
                // If this volume is significantly higher than recent average
                if (volume > avgPrevVolume + settings.significantVolumeChange) {
                    // Potential new strum or chord
                    const timeSinceLastStrum = now - settings.lastSignificantChange;
                    
                    if (timeSinceLastStrum > settings.minTimeBetweenStrums) {
                        // It's been enough time, this is likely a new strum
                        settings.lastSignificantChange = now;
                        
                        // Signal that a new strum may have happened (for attack detection)
                        this.isNewChordPossible = true;
                    }
                }
            }
        } else if (volume < settings.silenceThreshold - settings.silenceHysteresis) {
            // Volume below threshold, increment silence counter
            settings.silenceCounter++;
            
            // If we've been silent for enough frames, mark as inactive
            if (settings.silenceCounter >= settings.silenceFramesRequired) {
                settings.isActive = false;
            }
            
            // Process during silence transitions to allow chords to decay naturally
            shouldProcess = settings.isActive;
        } else {
            // In hysteresis zone - keep previous state but reset counter
            settings.silenceCounter = 0;
            shouldProcess = settings.isActive;
        }
        
        // Rate-limit processing regardless of audio state
        // This helps prevent excessive CPU usage and provides a more stable flow
        const minProcessInterval = 30; // ms between processing (about 33fps)
        const timeSinceLastProcess = now - settings.lastProcessedTime;
        
        if (timeSinceLastProcess < minProcessInterval) {
            // Too soon to process again
            shouldProcess = false;
        }
        
        // Process audio if conditions are met
        if (shouldProcess) {
            settings.lastProcessedTime = now;
            
            // Extract chromagram with enhanced filtering
            const chromagram = this.extractChromagram();
            
            // Detect chord using the chord detector
            const chordResult = this.chordDetector.detectChord(chromagram, volume);
            
            // Send the processed results
            if (this.onAudioProcessed) {
                this.onAudioProcessed({
                    volume,
                    chromagram,
                    chord: chordResult,
                    isNewStrum: this.isNewChordPossible || false
                });
            }
            
            // Reset new chord flag after sending
            this.isNewChordPossible = false;
        } else if (this.onAudioProcessed) {
            // Still send volume updates when not processing audio
            // but with no chord information
            this.onAudioProcessed({
                volume,
                chromagram: null,
                chord: null
            });
        }
        
        // Continue processing loop
        requestAnimationFrame(() => this.processAudio());
    }

    /**
     * Calculate the current audio volume (RMS) with dynamic noise floor
     * @returns {number} Volume level (0-1)
     */
    calculateVolume() {
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            sum += this.timeData[i] * this.timeData[i];
        }
        const currentRms = Math.sqrt(sum / this.timeData.length);
        
        // Initialize noise floor and volume history if not set
        if (!this.noiseFloor) {
            this.noiseFloor = 0.01; // Start with a reasonable floor
            this.volumeHistory = Array(10).fill(0);
            this.volumeHistoryIndex = 0;
            this.attackThreshold = 0.05; // Threshold for detecting a guitar attack
            this.silenceThreshold = 0.02; // Threshold for silence
            this.attackState = false; // Track if we're in an attack state
            this.attackStartTime = 0; // When the current attack started
            this.attackMinDuration = 300; // Min duration (ms) between separate attacks
        }
        
        // Update noise floor very slowly (only when quiet)
        if (currentRms < this.noiseFloor * 2) {
            // Adapt noise floor (very slowly) to drift in background noise
            this.noiseFloor = this.noiseFloor * 0.997 + currentRms * 0.003;
        }
        
        // Track this volume in history
        this.volumeHistory[this.volumeHistoryIndex] = currentRms;
        this.volumeHistoryIndex = (this.volumeHistoryIndex + 1) % this.volumeHistory.length;
        
        // Calculate median volume from history to detect spikes
        const sortedVolumes = [...this.volumeHistory].sort((a, b) => a - b);
        const medianVolume = sortedVolumes[Math.floor(sortedVolumes.length / 2)];
        
        // Apply noise gate - zero out if below threshold
        const gatedRms = currentRms > (this.noiseFloor * 3) ? 
            (currentRms - this.noiseFloor) : 0;
            
        // Track attack state - important for knowing when a new chord might be played
        const now = Date.now();
        
        // Check for new attack (significant volume increase)
        if (!this.attackState && gatedRms > this.attackThreshold && 
            gatedRms > medianVolume * 1.5) {
            
            this.attackState = true;
            this.attackStartTime = now;
            this.isNewChordPossible = true; // Signal that a new chord might be played
        }
        
        // Reset attack state after minimum duration or when volume drops
        if (this.attackState && 
            (now - this.attackStartTime > this.attackMinDuration || 
             gatedRms < this.silenceThreshold)) {
            
            this.attackState = false;
        }
        
        // Apply non-linear scaling to enhance contrast between quiet and loud sounds
        // This makes actual guitar playing stand out more from background noise
        return Math.min(1, Math.pow(gatedRms * 6, 1.2));
    }

    /**
     * Extract chromagram from frequency data with better noise handling
     * @returns {Array} 12-element array representing the chromagram
     */
    extractChromagram() {
        // Init chromagram array
        const chromagram = Array(12).fill(0);
        
        // Initialize chromagram history if not set
        if (!this.chromagramHistory) {
            this.chromagramHistory = [];
            this.chromagramHistorySize = 5; // Number of frames to keep
            this.energyThreshold = 0.05; // Higher energy threshold to reduce false activations
            this.noteEnergyFloor = 0.015; // Note-specific energy floor to filter out noise
        }
        
        // Guitar-specific frequency ranges - focused on standard tuning
        // Narrower range to focus on core guitar frequencies
        const minFreq = 80;   // Just below the lowest E string
        const maxFreq = 800;  // Above highest common note but catch some harmonics
        
        // Prepare a more detailed acoustic guitar frequency weighting
        // These are the frequencies of open strings in standard tuning (plus some common notes)
        // to better catch guitar-specific frequency patterns
        const guitarWeights = {
            // Open strings on acoustic guitar - boost these specific frequencies
            82.41: 2.8,   // E2 (low E)
            110.0: 2.5,   // A2
            146.83: 2.2,  // D3
            196.0: 2.0,   // G3
            246.94: 1.8,  // B3
            329.63: 1.6,  // E4 (high E)
            
            // Common fretted notes - moderate boost
            98.0: 1.6,    // G2 (3rd fret low E)
            123.47: 1.6,  // B2 (2nd fret A)
            164.81: 1.5,  // E3 (2nd fret D)
            220.0: 1.4,   // A3 (2nd fret G)
            293.66: 1.3,  // D4 (3rd fret B)
            349.23: 1.2,  // F4 (1st fret high E)
        };
        
        // Higher energy threshold when volume is low to reduce false positives
        const dynamicEnergyThreshold = this.attackState ? 
            this.energyThreshold * 0.7 : this.energyThreshold * 1.3;
        
        // Loop through the frequency data
        for (let i = 0; i < this.bufferLength; i++) {
            // Convert bin index to frequency
            const frequency = i * this.audioContext.sampleRate / this.fftSize;
            
            // Skip frequencies outside our target range
            if (frequency < minFreq) continue;
            if (frequency > maxFreq) break;
            
            // Get energy at this frequency bin (0-1)
            const energy = this.frequencyData[i] / 255;
            
            // Apply dynamic threshold based on attack state
            if (energy < dynamicEnergyThreshold) continue;
            
            // Convert frequency to MIDI note number
            // formula: 12 * log2(f/440) + 69
            const noteNumber = 12 * Math.log2(frequency / 440) + 69;
            
            // Get the pitch class (0-11) where 0=C, 1=C#, etc.
            const pitchClass = Math.round(noteNumber) % 12;
            
            // Apply sophisticated weighting
            let weight = 1.0;
            
            // Check if this frequency is close to a guitar-specific frequency
            for (const [guitarFreq, guitarWeight] of Object.entries(guitarWeights)) {
                // If within 3% of a target frequency, apply specific boost
                if (Math.abs(frequency - guitarFreq) / guitarFreq < 0.03) {
                    weight = guitarWeight;
                    break;
                }
            }
            
            // General frequency-range weighting
            if (frequency < 200) {
                // Bass notes are very important for chord detection
                weight *= 1.8;
            } else if (frequency < 350) {
                // Mid-range is important but less so
                weight *= 1.4;
            } else if (frequency > 600) {
                // Higher frequencies less important (often overtones)
                weight *= 0.6;
            }
            
            // Add the weighted energy to the corresponding pitch class
            chromagram[pitchClass] += energy * weight;
        }
        
        // Apply note-specific energy floor (zero out very low values)
        // This helps eliminate noise in rarely-played notes
        const cleanedChroma = chromagram.map(val => val < this.noteEnergyFloor ? 0 : val);
        
        // Normalize the chromagram
        const sum = cleanedChroma.reduce((a, b) => a + b, 0);
        let normalizedChroma = cleanedChroma;
        
        if (sum > 0) {
            normalizedChroma = cleanedChroma.map(value => value / sum);
        }
        
        // Add to history for smoothing
        this.chromagramHistory.push(normalizedChroma);
        if (this.chromagramHistory.length > this.chromagramHistorySize) {
            this.chromagramHistory.shift();
        }
        
        // Apply different smoothing strategies based on attack state
        let smoothedChroma;
        
        if (this.chromagramHistory.length < 2) {
            // Not enough history yet
            smoothedChroma = normalizedChroma;
        } else if (this.isNewChordPossible) {
            // If a new attack was detected, use current reading with less smoothing
            // This makes chord transitions more responsive
            smoothedChroma = normalizedChroma.map((val, i) => {
                const prevVal = this.chromagramHistory[this.chromagramHistory.length - 2][i];
                return val * 0.8 + prevVal * 0.2; // Weighted toward current frame
            });
            
            // Reset new chord flag
            this.isNewChordPossible = false;
        } else {
            // Otherwise apply stronger smoothing for stability
            // Calculate exponentially weighted average with more weight on recent frames
            smoothedChroma = Array(12).fill(0);
            let totalWeight = 0;
            
            for (let i = 0; i < this.chromagramHistory.length; i++) {
                const frameWeight = Math.pow(1.5, i); // Exponential weighting
                totalWeight += frameWeight;
                
                for (let j = 0; j < 12; j++) {
                    smoothedChroma[j] += this.chromagramHistory[i][j] * frameWeight;
                }
            }
            
            // Normalize by total weight
            smoothedChroma = smoothedChroma.map(val => val / totalWeight);
        }
        
        return smoothedChroma;
    }
    
    /**
     * Set callback function for audio processing results
     * @param {Function} callback Function to call with audio processing results
     */
    setAudioProcessedCallback(callback) {
        this.onAudioProcessed = callback;
    }
}
