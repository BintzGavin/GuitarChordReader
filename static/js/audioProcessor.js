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
        
        // Add sampling rate limiter for frequency logging
        this.lastFrequencyLogTime = 0;
        this.frequencyLogInterval = 500; // Only log frequencies every 500ms
    }

    /**
     * Initialize the audio context and request microphone access
     */
    async initialize() {
        console.log("Starting AudioProcessor initialization...");
        
        if (this.isInitialized) {
            console.log("AudioProcessor already initialized");
            return true;
        }
        
        try {
            // Create audio context but don't start it yet - it will start on user gesture
            console.log("Creating AudioContext...");
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                    latencyHint: 'interactive',
                    sampleRate: 44100
                });
                console.log("AudioContext created successfully, state:", this.audioContext.state);
            } catch (audioContextError) {
                console.error("Failed to create AudioContext:", audioContextError);
                alert("Your browser doesn't support audio processing. Please try a different browser.");
                return false;
            }
            
            // Create the chord detector
            console.log("Creating ChordDetector...");
            try {
                this.chordDetector = new ChordDetector();
                console.log("ChordDetector created successfully");
            } catch (err) {
                console.error("Failed to create ChordDetector:", err);
                return false;
            }
            
            // Initialize guitar-specific frequency weighting model
            console.log("Initializing guitar frequency weights...");
            this._initializeGuitarFrequencyWeights();
            console.log("Guitar frequency weights initialized");
            
            // Set up audio processing parameters
            console.log("Setting up audio processing parameters...");
            this.processingSettings = {
                silenceThreshold: 0.01, // Very low threshold for better sensitivity
                silenceHysteresis: 0.005, // Hysteresis to prevent rapid switching
                silenceFramesRequired: 30, // Number of silent frames before inactive
                silenceCounter: 0, // Counter for silent frames
                isActive: false, // Currently in active audio state
                volumeHistory: [], // For tracking recent volume levels
                lastSignificantChange: 0, // Timestamp of last significant volume change
                maxVolumeHistoryLength: 20, // Max frames to remember for volume
                significantVolumeChange: 0.1, // Volume change threshold to detect strums
                minTimeBetweenStrums: 120, // Min time (ms) between detected strums
                lastProcessedTime: 0 // Last time we processed audio
            };
            
            // For spectral flux onset detection
            this.prevSpectrum = null;
            this.fluxThreshold = 0.05;
            this.isNewChordPossible = false;
            
            this.isInitialized = true;
            console.log("AudioProcessor initialization complete!");
            return true;
        } catch (err) {
            console.error("Error during audio processor initialization:", err);
            return false;
        }
    }

    /**
     * Request microphone access and setup audio nodes
     * This must be called after a user gesture (like button click)
     */
    async setupAudio() {
        console.log("Setting up audio nodes and requesting microphone access...");
        
        if (!this.isInitialized) {
            console.error("AudioProcessor not initialized");
            return false;
        }
        
        try {
            // Request microphone stream with detailed error handling
            console.log("Requesting microphone access...");
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ 
                    audio: { 
                        echoCancellation: false,
                        noiseSuppression: false,
                        autoGainControl: false,
                        latency: 0,
                        channelCount: 1
                    } 
                });
                console.log("Microphone access granted");
                
                // Resume the AudioContext if it's suspended (needed for Safari)
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                    console.log("AudioContext resumed from suspended state");
                }
                
                // Create microphone source
                this.microphone = this.audioContext.createMediaStreamSource(stream);
                console.log("Microphone source created");
            } catch (micError) {
                console.error("Failed to access microphone:", micError);
                return false;
            }
            
            // Create analyzer node for frequency analysis
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = this.fftSize;
            this.analyser.smoothingTimeConstant = 0.3; // Balance between stability and responsiveness
            this.bufferLength = this.analyser.frequencyBinCount;
            
            // Create buffer arrays for frequency data
            this.frequencyData = new Uint8Array(this.bufferLength);
            this.timeData = new Uint8Array(this.fftSize);
            
            console.log(`Analyzer created with buffer length ${this.bufferLength}`);
            
            // Connect nodes: microphone -> analyser
            this.microphone.connect(this.analyser);
            
            // Create script processor node if needed for direct processing
            // This is a fallback for browsers without AudioWorklet support
            if (!this.processorNode) {
                try {
                    // Check for modern AudioWorkletNode support
                    if (typeof AudioWorkletNode === 'function' && 
                        typeof this.audioContext.audioWorklet?.addModule === 'function') {
                        
                        console.log("Using modern AudioWorklet for processing");
                        
                        // Add the processor module
                        try {
                            // Use optional chaining for safer access
                            await this.audioContext.audioWorklet?.addModule('js/chordProcessor.js');
                            
                            // Create the worklet node
                            this.processorNode = new AudioWorkletNode(
                                this.audioContext,
                                'chord-processor'
                            );
                            
                            // Set up message communication
                            this.processorNode.port.onmessage = (event) => {
                                console.log("Message from processor:", event.data);
                            };
                            
                            // Connect analyzer to processor
                            this.analyser.connect(this.processorNode);
                            
                            console.log("AudioWorklet processor connected");
                        } catch (workletError) {
                            console.error("Error setting up AudioWorklet:", workletError);
                            // Fall back to ScriptProcessor
                        }
                    }
                    
                    // Fallback to ScriptProcessor if Worklet failed or isn't available
                    if (!this.processorNode) {
                        console.log("Falling back to ScriptProcessor");
                        
                        const bufferSize = 4096;
                        this.javascriptNode = this.audioContext.createScriptProcessor(
                            bufferSize, 1, 1
                        );
                        
                        // Set processor callback
                        this.javascriptNode.onaudioprocess = () => {
                            // Request animation frame to avoid overwhelming the CPU
                            if (this.isRunning) {
                                requestAnimationFrame(() => this.processAudio());
                            }
                        };
                        
                        // Connect nodes
                        this.analyser.connect(this.javascriptNode);
                        this.javascriptNode.connect(this.audioContext.destination);
                        
                        console.log("ScriptProcessor fallback connected");
                    }
                } catch (processorError) {
                    console.error("Error creating processor node:", processorError);
                }
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
        console.log("Starting audio processor...");
        
        // More detailed checks
        if (!this.isInitialized) {
            console.error("Audio processor not initialized");
            throw new Error('Audio processor not initialized');
        }
        
        if (!this.analyser) {
            console.error("Analyzer not initialized - check setup");
            throw new Error('Analyzer not initialized');
        }
        
        if (!this.chordDetector) {
            console.error("Chord detector not initialized");
            // Try to create it if missing
            try {
                console.log("Attempting to create missing chord detector...");
                this.chordDetector = new ChordDetector();
            } catch (err) {
                console.error("Failed to create chord detector:", err);
                throw new Error('Failed to create chord detector');
            }
        }
        
        console.log("All checks passed, starting audio processing");
        this.isRunning = true;
        
        // Add fallback timer in case processAudio has an issue
        this.startupTimer = setTimeout(() => {
            if (!this.hasProcessedFrame) {
                console.warn("Audio processing didn't produce any frames within 2 seconds");
                // Try restarting the processing
                this.processAudio();
            }
        }, 2000);
        
        this.hasProcessedFrame = false;
        this.processAudio();
        console.log("Audio processing initiated");
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
            setTimeout(() => {
                if (this.isRunning) this.processAudio();
            }, 100);
            return;
        }
        
        // Get current audio data
        this.analyser.getByteTimeDomainData(this.timeData);
        this.analyser.getByteFrequencyData(this.frequencyData);
        
        // Calculate volume with dynamic noise floor
        const volume = this.calculateVolume();
        
        // Update volume history for trend analysis
        const settings = this.processingSettings;
        settings.volumeHistory.push(volume);
        if (settings.volumeHistory.length > settings.maxVolumeHistoryLength) {
            settings.volumeHistory.shift(); // Remove oldest
        }
        
        // Get current time for timing operations
        const now = Date.now();
        
        // Detect onset (new chord/strum) using spectral flux
        const isNewStrum = this._detectOnset();
        if (isNewStrum) {
            this.isNewChordPossible = true;
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
            // Limit chromagram logging to reduce console spam
            if (now - this.lastFrequencyLogTime > this.frequencyLogInterval) {
                console.log("Chromagram data:", chromagram, "Volume:", volume);
                this.lastFrequencyLogTime = now;
            }
            
            // Only log when we have a valid chromagram
            let chordResult = null;
            if (chromagram) {
                chordResult = this.chordDetector.detectChord(chromagram, volume, this.isNewChordPossible);
                console.log("Chord detected:", chordResult);
            }
            
            // Send the processed results
            if (this.onAudioProcessed) {
                try {
                    this.onAudioProcessed({
                        volume,
                        chromagram,
                        chord: chordResult || { name: "", type: "", confidence: 0 },
                        onsetDetected: this.isNewChordPossible || false
                    });
                    
                    // Mark that we've processed at least one frame successfully
                    this.hasProcessedFrame = true;
                    
                    // Clear the startup timer once we've processed a frame
                    if (this.startupTimer) {
                        clearTimeout(this.startupTimer);
                        this.startupTimer = null;
                    }
                } catch (callbackError) {
                    console.error("Error in audio processing callback:", callbackError);
                }
            }
            
            // Reset new chord flag after sending
            this.isNewChordPossible = false;
        } else if (this.onAudioProcessed) {
            // Still send volume updates when not processing audio
            // but with no chord information
            this.onAudioProcessed({
                volume,
                chromagram: null,
                chord: { name: "", type: "", confidence: 0 }
            });
        }
        
        // Schedule next frame if running but not using script processor
        if (this.isRunning && !this.javascriptNode) {
            requestAnimationFrame(() => this.processAudio());
        }
    }

    /**
     * Calculate the current audio volume (RMS) with dynamic noise floor
     * @returns {number} Volume level (0-1)
     */
    calculateVolume() {
        // Use time domain data for volume calculation
        let sumSquares = 0.0;
        const length = this.timeData.length;
        
        // Calculate RMS
        for (let i = 0; i < length; i++) {
            // Convert from 0-255 to -1.0 to 1.0
            const amplitude = ((this.timeData[i] / 128.0) - 1.0);
            sumSquares += amplitude * amplitude;
        }
        
        // RMS = sqrt(average(sumSquares))
        let rms = Math.sqrt(sumSquares / length);
        
        // Apply adaptive noise floor
        const noiseFloor = 0.005; // Estimated noise floor
        if (rms < noiseFloor) {
            rms = 0;
        } else {
            // Subtract noise floor with soft thresholding
            rms = Math.max(0, rms - noiseFloor);
        }
        
        // Scale output for better dynamic range
        return Math.min(1.0, rms * 5); // Enhance low volumes for better detection
    }

    /**
     * Extract chromagram from frequency data with better noise handling
     * @returns {Array} 12-element array representing the chromagram
     */
    extractChromagram() {
        // Initialize a chromagram to store the energy in each of the 12 pitch classes
        const chromagram = Array(12).fill(0);
        
        // Convert frequency data from Uint8Array (0-255) to float (0-1)
        const normalizedFrequencyData = Array.from(this.frequencyData).map(val => val / 255);
        
        // Sample rate and FFT size determine frequency resolution
        const sampleRate = this.audioContext.sampleRate;
        const binCount = normalizedFrequencyData.length;
        const binWidth = sampleRate / (this.fftSize * 2); // Hz per bin
        
        // Frequency range for guitar is roughly 80 Hz (low E) to 1175 Hz (high E, 24th fret)
        // We also include some overtones beyond this range
        const minFreq = 60; // Bit below the lowest standard guitar frequency
        const maxFreq = 1500; // Includes overtones important for timbre recognition
        
        // Frequency to MIDI note conversion reference: A4 (440Hz) = MIDI note 69
        const freqToMidi = (freq) => 69 + 12 * Math.log2(freq / 440);
        const midiToChroma = (midi) => Math.round(midi) % 12;
        
        // Process each frequency bin to extract the chromagram
        for (let i = 0; i < binCount; i++) {
            const frequency = i * binWidth;
            
            // Skip frequencies outside our range of interest
            if (frequency < minFreq || frequency > maxFreq) continue;
            
            // Get the energy (amplitude) in this bin
            const energy = normalizedFrequencyData[i];
            
            // Apply frequency-dependent weighting to favor the guitar's range
            const weight = this._getFrequencyWeight(frequency);
            
            // Only process bins with significant energy (noise reduction)
            // Using lower threshold for better sensitivity
            if (energy > 0.05) { 
                // Only log frequencies with the sampling rate limiter
                const now = Date.now();
                if (now - this.lastFrequencyLogTime > this.frequencyLogInterval) {
                    console.log(`Detected frequency: ${frequency} Hz with energy: ${energy}`);
                }
            }
            
            if (energy > 0.02) { // Lower threshold to keep more information
                // Convert frequency to MIDI note number
                const midiNote = freqToMidi(frequency);
                
                // Convert MIDI note to chroma (0-11) representing pitch class
                const chroma = midiToChroma(midiNote);
                
                // Add weighted energy to appropriate bin in chromagram
                chromagram[chroma] += energy * weight;
            }
        }
        
        // Normalize the chromagram so the sum equals 1
        const sum = chromagram.reduce((a, b) => a + b, 0);
        
        // Debug normalization with more context
        console.log("Normalized chromagram with sum:", sum, chromagram);
        
        if (sum > 0) {
            for (let i = 0; i < 12; i++) {
                chromagram[i] /= sum;
            }
        }
        
        // Apply harmonic product spectrum to enhance fundamental frequencies
        this._applyHarmonicProductSpectrum(chromagram, normalizedFrequencyData);
        
        // Return final processed chromagram
        console.log("Final smoothed chromagram:", chromagram);
        return chromagram;
    }

    /**
     * Initialize the detailed frequency weighting model for guitar-specific detection
     * @private
     */
    _initializeGuitarFrequencyWeights() {
        // Parameters for weighting frequencies for guitar
        this.frequencyWeights = {
            // Guitar strings open frequencies (standard tuning)
            strings: [
                82.41, // E2
                110.0, // A2
                146.83, // D3
                196.0, // G3
                246.94, // B3
                329.63  // E4
            ],
            // Peak width controls how focused the weight is around each guitar frequency
            peakWidth: 0.2,
            // How much to boost frequencies in the normal guitar range
            rangeFactor: 1.5, 
            // Minimum weight for any frequency (avoid zeros)
            minWeight: 0.01
        };
    }

    /**
     * Get the weight for a specific frequency based on the guitar model
     * @param {number} frequency The frequency to get weight for
     * @returns {number} The weight for this frequency
     * @private
     */
    _getFrequencyWeight(frequency) {
        if (!this.frequencyWeights) {
            return 1.0; // Default weight if not initialized
        }
        
        // Start with base weight
        let weight = this.frequencyWeights.minWeight;
        
        // Boost frequencies in the guitar's main range 
        // (approximately 80Hz - 1200Hz including most normal playing)
        if (frequency >= 80 && frequency <= 1200) {
            weight = this.frequencyWeights.rangeFactor;
            
            // Extra boost around open string frequencies and their octaves
            for (const stringFreq of this.frequencyWeights.strings) {
                // Check base frequency and octaves
                for (let octave = 0; octave < 3; octave++) {
                    const targetFreq = stringFreq * Math.pow(2, octave);
                    
                    // Calculate distance from this target frequency, normalized
                    const distance = Math.abs(frequency - targetFreq) / targetFreq;
                    
                    // If we're close to a guitar string frequency, boost it
                    if (distance < this.frequencyWeights.peakWidth) {
                        // More boost the closer we are to the exact frequency (gaussian-like)
                        const octaveBoost = 1.0 / (octave + 1); // Lower boost for higher octaves
                        const proximityBoost = (1 - (distance / this.frequencyWeights.peakWidth)) * 2 * octaveBoost;
                        weight += proximityBoost;
                    }
                }
            }
        } else if (frequency > 1200) {
            // Higher frequencies get gradually less weight (but still relevant for timbre)
            weight = this.frequencyWeights.minWeight + 
                     (this.frequencyWeights.rangeFactor - this.frequencyWeights.minWeight) * 
                     Math.exp(-(frequency - 1200) / 800);
        }
        
        return weight;
    }

    /**
     * Detect onset (sudden changes in audio signal) using spectral flux and energy analysis
     * @returns {boolean} Whether an onset was detected
     * @private
     */
    _detectOnset() {
        if (!this.prevSpectrum) {
            // First frame, initialize previous spectrum
            this.prevSpectrum = [...this.frequencyData];
            return false;
        }
        
        // Calculate spectral flux - how much the spectrum changed
        let flux = 0;
        const halfSpectrum = Math.min(this.frequencyData.length, 1024); // Limit to lower frequencies
        
        for (let i = 0; i < halfSpectrum; i++) {
            // Only count positive changes in spectrum (increases in energy)
            const diff = (this.frequencyData[i] / 255) - (this.prevSpectrum[i] / 255);
            flux += diff > 0 ? diff : 0;
        }
        
        // Store current spectrum for next frame
        this.prevSpectrum = [...this.frequencyData];
        
        // Detect onset if flux is above threshold
        return flux > this.fluxThreshold;
    }

    /**
     * Apply Harmonic Product Spectrum algorithm to enhance fundamental frequency detection
     * @param {Array} chromagram The chromagram to enhance
     * @param {Array} spectralData The spectral data to analyze
     * @private
     */
    _applyHarmonicProductSpectrum(chromagram, spectralData) {
        // We'll use a simplified HPS to boost fundamental frequencies
        for (let i = 0; i < 12; i++) {
            // Original energy at this pitch class
            let energy = chromagram[i];
            
            // Check for energy at the first harmonic (octave)
            const octave = (i + 12) % 12;
            
            // If the octave also has energy, this reinforces the fundamental
            if (chromagram[octave] > 0.1) {
                energy *= 1.1; // Small boost
            }
            
            // Check for energy at the second harmonic (perfect fifth)
            const fifth = (i + 7) % 12;
            if (chromagram[fifth] > 0.1) {
                energy *= 1.05; // Even smaller boost
            }
            
            // Update chromagram with enhanced energy
            chromagram[i] = energy;
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
