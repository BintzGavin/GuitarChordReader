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
            
            // Initialize our advanced audio processing components
            this._initializeGuitarFrequencyWeights();
            
            // Initialize internal state for tracking
            this.chromagramHistory = [];
            this.chromagramHistorySize = 5;
            this.energyThreshold = 0.05;
            this.noteEnergyFloor = 0.015;
            
            // Initialize Harmonic Product Spectrum
            this.harmonicProductSpectrum = {
                enabled: true,
                harmonics: 3,
                weights: [1.0, 0.85, 0.55]
            };
            
            // Initialize onset detection
            this.onsetDetection = {
                enabled: true,
                bufferSize: 8,
                energyThreshold: 1.4,
                spectralFluxThreshold: 2.0,
                lastOnsetTime: 0,
                minTimeBetweenOnsets: 150,
                energyHistory: [],
                spectralHistory: []
            };
            
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
        console.log("Setting up audio system...");
        
        if (!this.audioContext) {
            console.error("Audio context not initialized!");
            alert("Audio system failed to initialize. Please refresh the page and try again.");
            return false;
        }
        
        if (this.audioContext.state === 'suspended') {
            console.log("Resuming suspended audio context...");
            try {
                await this.audioContext.resume();
                console.log("Audio context resumed successfully");
            } catch (resumeError) {
                console.error("Failed to resume audio context:", resumeError);
                alert("Failed to start audio system. Please try again or check browser permissions.");
                return false;
            }
        }
        
        try {
            console.log("Requesting microphone access...");
            
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: { 
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                } 
            });
            
            console.log("Microphone access granted!");
            
            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            console.log("Microphone source created");
            
            // Create analyzer node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.8;
            this.bufferLength = this.analyser.frequencyBinCount;
            
            console.log(`Analyzer created with FFT size: ${this.fftSize}, buffer length: ${this.bufferLength}`);
            
            // Create data buffers
            this.frequencyData = new Uint8Array(this.bufferLength);
            this.timeData = new Float32Array(this.fftSize);
            
            console.log("Data buffers created");
            
            // Connect microphone to analyzer
            this.microphone.connect(this.analyser);
            console.log("Microphone connected to analyzer");
            
            // Initialize components that depend on audio setup
            this._initializeGuitarFrequencyWeights();
            
            // Make sure onset detection is initialized
            if (!this.onsetDetection) {
                this.onsetDetection = {
                    enabled: true,
                    bufferSize: 8,
                    energyThreshold: 1.4, 
                    spectralFluxThreshold: 2.0,
                    lastOnsetTime: 0,
                    minTimeBetweenOnsets: 150,
                    energyHistory: Array(8).fill(0),
                    spectralHistory: Array(8).fill(null)
                };
            }
            
            // Check if harmonicProductSpectrum is initialized
            if (!this.harmonicProductSpectrum) {
                this.harmonicProductSpectrum = {
                    enabled: true,
                    harmonics: 3,
                    weights: [1.0, 0.85, 0.55]
                };
            }
            
            console.log("Audio system setup complete!");
            return true;
        } catch (error) {
            console.error('Error setting up audio:', error);
            
            // More specific error messaging
            if (error.name === 'NotAllowedError') {
                alert('Microphone access denied. Please allow microphone access in your browser settings.');
            } else if (error.name === 'NotFoundError') {
                alert('No microphone found. Please connect a microphone and try again.');
            } else {
                alert(`Failed to access microphone: ${error.message}`);
            }
            
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
        
        // Check if analyser and data arrays are available
        if (!this.analyser || !this.timeData || !this.frequencyData) {
            console.warn("Audio processing components not initialized yet, trying again soon");
            requestAnimationFrame(() => this.processAudio());
            return;
        }

        try {
            // Get time domain data
            this.analyser.getFloatTimeDomainData(this.timeData);
            
            // Get frequency data
            this.analyser.getByteFrequencyData(this.frequencyData);
            
            // Calculate volume level with noise gating
            const volume = this.calculateVolume();
        } catch (error) {
            console.error("Error during audio processing:", error);
            requestAnimationFrame(() => this.processAudio());
            return;
        }
        
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
        
        // The advanced settings should already be initialized in the initialize() method
        // This is just a safety check in case something went wrong
        if (!this.guitarModel || !this.guitarModel.frequencyWeights || 
            Object.keys(this.guitarModel.frequencyWeights).length === 0) {
            console.log("Initializing guitar frequency weights that weren't properly set up");
            this._initializeGuitarFrequencyWeights();
        }
        
        // Check if onset detection history is initialized
        if (!this.onsetDetection.energyHistory.length) {
            this.onsetDetection.energyHistory = Array(this.onsetDetection.bufferSize).fill(0);
            this.onsetDetection.spectralHistory = Array(this.onsetDetection.bufferSize).fill(null);
        }
        
        // Prepare guitar-specific frequency ranges
        const minFreq = 80;   // Just below the lowest E string
        const maxFreq = 1100; // Increased to capture more harmonics for better chord detection
        
        // Run onset detection first to identify possible chord changes
        const onsetDetected = this._detectOnset();
        
        // Set isNewChordPossible based on onset detection
        if (onsetDetected) {
            this.isNewChordPossible = true;
        }
        
        // Higher energy threshold when volume is low to reduce false positives
        const dynamicEnergyThreshold = this.isNewChordPossible ? 
            this.energyThreshold * 0.65 : this.energyThreshold * 1.3;
        
        // Store spectral data for harmonic product spectrum calculation
        let spectralData = [];
        
        // Loop through the frequency data
        for (let i = 0; i < this.bufferLength; i++) {
            // Convert bin index to frequency
            const frequency = i * this.audioContext.sampleRate / this.fftSize;
            
            // Skip frequencies outside our target range
            if (frequency < minFreq) continue;
            if (frequency > maxFreq) break;
            
            // Get energy at this frequency bin (0-1)
            const energy = this.frequencyData[i] / 255;
            
            // Store for HPS calculation
            spectralData.push({ frequency, energy });
            
            // Apply dynamic threshold based on onset state
            if (energy < dynamicEnergyThreshold) continue;
            
            // Convert frequency to MIDI note number
            // formula: 12 * log2(f/440) + 69
            const noteNumber = 12 * Math.log2(frequency / 440) + 69;
            
            // Get the pitch class (0-11) where 0=C, 1=C#, etc.
            const pitchClass = Math.round(noteNumber) % 12;
            
            // Apply sophisticated weighting from guitar model
            let weight = this._getFrequencyWeight(frequency);
            
            // Add the weighted energy to the corresponding pitch class
            chromagram[pitchClass] += energy * weight;
        }
        
        // Apply Harmonic Product Spectrum if enabled
        if (this.harmonicProductSpectrum.enabled && spectralData.length > 0) {
            this._applyHarmonicProductSpectrum(chromagram, spectralData);
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
        
        // Apply different smoothing strategies based on onset detection
        let smoothedChroma;
        
        if (this.chromagramHistory.length < 2) {
            // Not enough history yet
            smoothedChroma = normalizedChroma;
        } else if (this.isNewChordPossible) {
            // If onset was detected, use current reading with minimal smoothing
            // This makes chord transitions more responsive
            smoothedChroma = normalizedChroma.map((val, i) => {
                const prevVal = this.chromagramHistory[this.chromagramHistory.length - 2][i];
                return val * 0.85 + prevVal * 0.15; // Heavily weighted toward current frame
            });
        } else {
            // Otherwise apply adaptive smoothing for stability
            // Calculate exponentially weighted average with more weight on recent frames
            smoothedChroma = Array(12).fill(0);
            let totalWeight = 0;
            
            // Only use a small window of frames if we have just come out of an onset
            const framesUsed = (Date.now() - this.onsetDetection.lastOnsetTime < 500) ? 
                Math.min(3, this.chromagramHistory.length) : this.chromagramHistory.length;
            
            for (let i = 0; i < framesUsed; i++) {
                // Use reversed index to weight recent frames more highly
                const idx = this.chromagramHistory.length - 1 - i;
                const frameWeight = Math.pow(1.8, framesUsed - i - 1); // Exponential weighting
                totalWeight += frameWeight;
                
                for (let j = 0; j < 12; j++) {
                    smoothedChroma[j] += this.chromagramHistory[idx][j] * frameWeight;
                }
            }
            
            // Normalize by total weight
            smoothedChroma = smoothedChroma.map(val => val / totalWeight);
        }
        
        // Reset new chord flag after processing
        if (!onsetDetected) {
            this.isNewChordPossible = false;
        }
        
        return smoothedChroma;
    }
    
    /**
     * Initialize the detailed frequency weighting model for guitar-specific detection
     * @private
     */
    _initializeGuitarFrequencyWeights() {
        // Make sure guitarModel is initialized
        if (!this.guitarModel) {
            this.guitarModel = {
                frequencyWeights: {}
            };
        }
        
        // Make sure frequencyWeights is initialized
        if (!this.guitarModel.frequencyWeights) {
            this.guitarModel.frequencyWeights = {};
        }
        
        // Make sure we have the open strings data
        if (!this.guitarModel.openStrings) {
            this.guitarModel.openStrings = [
                { note: 'E2', freq: 82.41, harmonics: [82.41, 164.82, 247.23, 329.64] },
                { note: 'A2', freq: 110.0, harmonics: [110.0, 220.0, 330.0, 440.0] },
                { note: 'D3', freq: 146.83, harmonics: [146.83, 293.66, 440.49, 587.32] },
                { note: 'G3', freq: 196.0, harmonics: [196.0, 392.0, 588.0, 784.0] },
                { note: 'B3', freq: 246.94, harmonics: [246.94, 493.88, 740.82, 987.76] },
                { note: 'E4', freq: 329.63, harmonics: [329.63, 659.26, 988.89, 1318.52] }
            ];
        }
        
        // Initialize with the open string frequencies
        for (const string of this.guitarModel.openStrings) {
            // Add the fundamental frequency with full weight
            this.guitarModel.frequencyWeights[string.freq.toFixed(2)] = 3.0;
            
            // Add harmonics with decreasing weights
            for (let i = 1; i < string.harmonics.length; i++) {
                const harmonic = string.harmonics[i];
                this.guitarModel.frequencyWeights[harmonic.toFixed(2)] = 3.0 / (i + 1);
            }
        }
        
        // Add common fretted notes on each string (up to 12th fret)
        for (const string of this.guitarModel.openStrings) {
            const baseFreq = string.freq;
            
            for (let fret = 1; fret <= 12; fret++) {
                // Calculate fretted note frequency: base * 2^(fret/12)
                const fretFreq = baseFreq * Math.pow(2, fret/12);
                // Higher weight for common chord positions (1, 2, 3, 5, 7, 8, 10, 12)
                const isCommonFret = [1, 2, 3, 5, 7, 8, 10, 12].includes(fret);
                
                this.guitarModel.frequencyWeights[fretFreq.toFixed(2)] = isCommonFret ? 2.0 : 1.5;
            }
        }
        
        // Add special boosts for frequencies that are important in common chord shapes
        const specialBoosts = {
            // Low E shape (E, Em)
            82.41: 3.0,   // E2 (Low E string)
            146.83: 2.2,  // D3 (D string)
            246.94: 2.0,  // B3 (B string)
            
            // A shape (A, Am)
            110.0: 3.0,   // A2 (A string)
            164.81: 2.5,  // E3 (2nd fret D string)
            196.0: 2.2,   // G3 (G string)
            
            // C shape
            131.87: 2.8,  // C3 (3rd fret A string)
            164.81: 2.5,  // E3 (2nd fret D string)
            261.63: 2.3,  // C4 (1st fret B string)
            
            // D shape
            146.83: 2.8,  // D3 (D string)
            220.0: 2.5,   // A3 (A string - 2nd fret G string)
            293.66: 2.3,  // D4 (3rd fret B string)
            
            // G shape
            98.0: 2.8,    // G2 (3rd fret E string)
            196.0: 2.5,   // G3 (G string)
            246.94: 2.3,  // B3 (B string)
            
            // F shape (barre chord)
            87.31: 2.8,   // F2 (1st fret low E)
            174.61: 2.5,  // F3 (3rd fret D string)
            349.23: 2.3,  // F4 (1st fret high E)
        };
        
        // Apply the special boosts
        for (const [freq, boost] of Object.entries(specialBoosts)) {
            this.guitarModel.frequencyWeights[freq] = boost;
        }
    }
    
    /**
     * Get the weight for a specific frequency based on the guitar model
     * @param {number} frequency The frequency to get weight for
     * @returns {number} The weight for this frequency
     * @private
     */
    _getFrequencyWeight(frequency) {
        let weight = 1.0;
        
        // Check all weights with a tolerance of 1.5%
        for (const [guitarFreq, guitarWeight] of Object.entries(this.guitarModel.frequencyWeights)) {
            const targetFreq = parseFloat(guitarFreq);
            // If within tolerance of a target frequency, apply specific boost
            if (Math.abs(frequency - targetFreq) / targetFreq < 0.015) {
                weight = guitarWeight;
                break;
            }
        }
        
        // General frequency-range weighting based on guitar acoustics
        if (frequency < 150) {
            // Bass notes are very important for chord detection
            weight *= 2.2;
        } else if (frequency < 350) {
            // Mid-range is important but less so
            weight *= 1.8;
        } else if (frequency < 600) {
            // Upper midrange
            weight *= 1.4;
        } else if (frequency < 800) {
            // Typical highest notes on guitar
            weight *= 1.0;
        } else {
            // Higher frequencies less important (often overtones)
            weight *= 0.6;
        }
        
        return weight;
    }
    
    /**
     * Detect onset (sudden changes in audio signal) using spectral flux and energy analysis
     * @returns {boolean} Whether an onset was detected
     * @private
     */
    _detectOnset() {
        try {
            // Make sure onsetDetection is properly initialized
            if (!this.onsetDetection) {
                this.onsetDetection = {
                    enabled: true,
                    bufferSize: 8,
                    energyThreshold: 1.4,
                    spectralFluxThreshold: 2.0,
                    lastOnsetTime: 0,
                    minTimeBetweenOnsets: 150,
                    energyHistory: [],
                    spectralHistory: []
                };
            }
            
            // Safety check for required data
            if (!this.timeData || !this.timeData.length || !this.frequencyData || !this.frequencyData.length) {
                return false;
            }
            
            if (!this.onsetDetection.enabled) return false;
            
            const now = Date.now();
            
            // Don't check for onsets too frequently
            if (now - this.onsetDetection.lastOnsetTime < this.onsetDetection.minTimeBetweenOnsets) {
                return false;
            }
            
            // Calculate current frame energy
            let currentEnergy = 0;
            for (let i = 0; i < this.timeData.length; i++) {
                currentEnergy += this.timeData[i] * this.timeData[i];
            }
            currentEnergy = Math.sqrt(currentEnergy / this.timeData.length);
            
            // Add to history (initialize if empty)
            if (!this.onsetDetection.energyHistory) {
                this.onsetDetection.energyHistory = [];
            }
            
            this.onsetDetection.energyHistory.push(currentEnergy);
            if (this.onsetDetection.energyHistory.length > this.onsetDetection.bufferSize) {
                this.onsetDetection.energyHistory.shift();
            }
            
            // Initialize spectral history if needed
            if (!this.onsetDetection.spectralHistory) {
                this.onsetDetection.spectralHistory = [];
            }
            
            // Calculate spectral flux (difference in spectrum between consecutive frames)
            // Only possible if we have at least 2 frames
            let spectralFlux = 0;
            if (this.onsetDetection.spectralHistory.length > 0) {
                const previousSpectrum = this.onsetDetection.spectralHistory[this.onsetDetection.spectralHistory.length - 1];
                
                if (previousSpectrum && Array.isArray(previousSpectrum) && previousSpectrum.length > 0) {
                    // Calculate flux as sum of squared differences
                    const minLength = Math.min(this.frequencyData.length, previousSpectrum.length);
                    
                    for (let i = 0; i < minLength; i++) {
                        const diff = (this.frequencyData[i] / 255) - previousSpectrum[i];
                        // Only count positive differences (increases in energy)
                        if (diff > 0) {
                            spectralFlux += diff * diff;
                        }
                    }
                }
            }
        
        // Store current spectrum
        const currentSpectrum = Array.from(this.frequencyData).map(v => v / 255);
        this.onsetDetection.spectralHistory.push(currentSpectrum);
        if (this.onsetDetection.spectralHistory.length > this.onsetDetection.bufferSize) {
            this.onsetDetection.spectralHistory.shift();
        }
        
        // If we don't have enough history yet, we can't detect onsets
        if (this.onsetDetection.energyHistory.length < 3) {
            return false;
        }
        
        // Calculate average of previous energy values (excluding current)
        const prevEnergies = this.onsetDetection.energyHistory.slice(0, -1);
        const avgEnergy = prevEnergies.reduce((sum, val) => sum + val, 0) / prevEnergies.length;
        
        // Get the previous spectral flux values if available
        let avgSpectralFlux = 0;
        if (this.onsetDetection.spectralHistory.length > 3) {
            // Calculate average of previous spectral flux values
            let fluxSum = 0;
            let fluxCount = 0;
            
            for (let i = 0; i < this.onsetDetection.spectralHistory.length - 2; i++) {
                const prev = this.onsetDetection.spectralHistory[i];
                const next = this.onsetDetection.spectralHistory[i + 1];
                
                let frameFlux = 0;
                for (let j = 0; j < prev.length; j++) {
                    const diff = next[j] - prev[j];
                    if (diff > 0) {
                        frameFlux += diff * diff;
                    }
                }
                
                fluxSum += frameFlux;
                fluxCount++;
            }
            
            if (fluxCount > 0) {
                avgSpectralFlux = fluxSum / fluxCount;
            }
        }
        
        // Check if current energy is significantly higher than average (potential onset)
        const energyRatio = currentEnergy / (avgEnergy + 0.00001); // Avoid division by zero
        const fluxRatio = spectralFlux / (avgSpectralFlux + 0.00001);
        
        // Onset detected if either energy or spectral flux shows significant change
        const isEnergyOnset = energyRatio > this.onsetDetection.energyThreshold && currentEnergy > 0.02;
        const isSpectralOnset = fluxRatio > this.onsetDetection.spectralFluxThreshold && spectralFlux > 0.01;
        
        if (isEnergyOnset || isSpectralOnset) {
            // Record the onset time for debouncing
            this.onsetDetection.lastOnsetTime = now;
            return true;
        }
        
        return false;
        } catch (error) {
            console.error("Error in onset detection:", error);
            return false;
        }
    }
    
    /**
     * Apply Harmonic Product Spectrum algorithm to enhance fundamental frequency detection
     * @param {Array} chromagram The chromagram to enhance
     * @param {Array} spectralData The spectral data to analyze
     * @private
     */
    _applyHarmonicProductSpectrum(chromagram, spectralData) {
        // Make sure harmonicProductSpectrum is properly initialized
        if (!this.harmonicProductSpectrum) {
            this.harmonicProductSpectrum = {
                enabled: true,
                harmonics: 3,
                weights: [1.0, 0.85, 0.55]
            };
        }
        
        // Safety check for parameters
        if (!this.harmonicProductSpectrum || !this.harmonicProductSpectrum.harmonics || !this.harmonicProductSpectrum.weights) {
            console.error("HarmonicProductSpectrum not properly initialized");
            return; // Exit without processing
        }
        
        const harmonics = this.harmonicProductSpectrum.harmonics || 3;
        const weights = this.harmonicProductSpectrum.weights || [1.0, 0.85, 0.55];
        
        // Safety check for spectral data
        if (!spectralData || !Array.isArray(spectralData) || spectralData.length === 0) {
            console.error("No spectral data available for HPS processing");
            return; // Exit without processing
        }
        
        // Group spectral data by pitch class
        const pitchClassData = Array(12).fill().map(() => []);
        
        // Assign each frequency to its pitch class
        for (const entry of spectralData) {
            // Safety check for valid data
            if (!entry || typeof entry.frequency !== 'number' || typeof entry.energy !== 'number') {
                continue; // Skip invalid entries
            }
            
            const frequency = entry.frequency;
            const energy = entry.energy;
            
            // Calculate note number and pitch class
            const noteNumber = 12 * Math.log2(frequency / 440) + 69;
            const pitchClass = Math.round(noteNumber) % 12;
            
            // Ensure valid pitch class (0-11)
            if (pitchClass >= 0 && pitchClass < 12) {
                pitchClassData[pitchClass].push({ frequency, energy });
            }
        }
        
        // Apply HPS to each pitch class separately
        for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
            const entries = pitchClassData[pitchClass];
            if (entries.length === 0) continue;
            
            // Sort by frequency
            entries.sort((a, b) => a.frequency - b.frequency);
            
            // Apply HPS processing
            let hpsValue = 0;
            
            for (const { frequency, energy } of entries) {
                // Skip if too low energy
                if (energy < 0.05) continue;
                
                // Find harmonics for this frequency
                let harmonicProduct = energy * weights[0]; // Start with fundamental
                
                for (let h = 1; h < harmonics; h++) {
                    if (h >= weights.length) break;
                    
                    // Calculate expected frequency of harmonic
                    const harmonicFreq = frequency * (h + 1);
                    
                    // Find closest actual frequency and get its energy
                    let bestDistance = Infinity;
                    let harmonicEnergy = 0;
                    
                    for (const entry of spectralData) {
                        const distance = Math.abs(entry.frequency - harmonicFreq);
                        const relativeDist = distance / harmonicFreq;
                        
                        // If within 3% of expected harmonic, consider it
                        if (relativeDist < 0.03 && relativeDist < bestDistance) {
                            bestDistance = relativeDist;
                            harmonicEnergy = entry.energy;
                        }
                    }
                    
                    // Multiply by harmonic energy (with appropriate weight)
                    harmonicProduct *= Math.pow(harmonicEnergy, weights[h]);
                }
                
                // Add to total HPS value for this pitch class
                hpsValue += harmonicProduct;
            }
            
            // Add HPS result to chromagram
            chromagram[pitchClass] += hpsValue;
        }
    }
    
    /**
     * Set callback function for audio processing results
     * @param {Function} callback Function to call with audio processing results
     */
    setAudioProcessedCallback(callback) {
        this.onAudioProcessed = callback;
    }
}
