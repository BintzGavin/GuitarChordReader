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
     * Process audio data from the microphone
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
        
        // Calculate volume level (RMS)
        const volume = this.calculateVolume();
        
        // Extract chromagram
        const chromagram = this.extractChromagram();
        
        // Detect chord using the chord detector
        const chordResult = this.chordDetector.detectChord(chromagram, volume);
        
        // Trigger callback with results
        if (this.onAudioProcessed) {
            this.onAudioProcessed({
                volume,
                chromagram,
                chord: chordResult
            });
        }
        
        // Continue processing
        requestAnimationFrame(() => this.processAudio());
    }

    /**
     * Calculate the current audio volume (RMS)
     * @returns {number} Volume level (0-1)
     */
    calculateVolume() {
        let sum = 0;
        for (let i = 0; i < this.timeData.length; i++) {
            sum += this.timeData[i] * this.timeData[i];
        }
        const rms = Math.sqrt(sum / this.timeData.length);
        return Math.min(1, rms * 5); // Scale up a bit, but cap at 1
    }

    /**
     * Extract chromagram from frequency data
     * @returns {Array} 12-element array representing the chromagram
     */
    extractChromagram() {
        const chromagram = Array(12).fill(0);
        
        // Guitar-specific frequency ranges - focused on standard tuning
        // E2 (82.4Hz) to E5 (659.3Hz) covers most acoustic guitar ranges
        const minFreq = 80;  // Just below the lowest E string
        const maxFreq = 700; // Just above the highest common note
        
        // Weight for harmonics - we'll weight the fundamentals higher
        const harmonicWeighting = true;
        
        // Loop through the frequency data
        for (let i = 0; i < this.bufferLength; i++) {
            // Convert bin index to frequency
            const frequency = i * this.audioContext.sampleRate / this.fftSize;
            
            // Skip frequencies outside our target range
            if (frequency < minFreq) continue;
            if (frequency > maxFreq) break;
            
            // Get energy at this frequency bin
            const energy = this.frequencyData[i] / 255;
            
            // Skip bins with very low energy
            if (energy < 0.01) continue;
            
            // Convert frequency to MIDI note number
            // formula: 12 * log2(f/440) + 69
            const noteNumber = 12 * Math.log2(frequency / 440) + 69;
            
            // Get the pitch class (0-11) where 0=C, 1=C#, etc.
            const pitchClass = Math.round(noteNumber) % 12;
            
            // Apply weighting based on frequency range
            let weight = 1.0;
            
            if (harmonicWeighting) {
                // Boost the fundamental frequencies (lower range) that are more important for chord detection
                // and reduce the weight of higher harmonics
                if (frequency < 300) {
                    weight = 1.5; // Boost the fundamentals (bass notes)
                } else if (frequency > 500) {
                    weight = 0.7; // Reduce high harmonics
                }
            }
            
            // Add the weighted energy to the corresponding pitch class
            chromagram[pitchClass] += energy * weight;
        }
        
        // Normalize the chromagram
        const sum = chromagram.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            return chromagram.map(value => value / sum);
        }
        
        return chromagram;
    }
    
    /**
     * Set callback function for audio processing results
     * @param {Function} callback Function to call with audio processing results
     */
    setAudioProcessedCallback(callback) {
        this.onAudioProcessed = callback;
    }
}
