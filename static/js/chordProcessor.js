/**
 * AudioWorklet processor for real-time chord processing
 */
class ChordProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.bufferSize = 4096;
        this.buffer = new Float32Array(this.bufferSize);
        this.bufferIndex = 0;
        
        // Process message from main thread
        this.port.onmessage = (event) => {
            if (event.data.type === 'init') {
                console.log('ChordProcessor initialized with settings:', event.data.settings);
            }
        };
    }

    /**
     * Process audio data
     * @param {Array} inputs Array of input audio data
     * @param {Array} outputs Array of output audio data
     * @param {Object} parameters Processing parameters
     * @returns {boolean} Whether to continue processing
     */
    process(inputs, outputs, parameters) {
        // Get the first input channel's data
        const input = inputs[0][0];
        
        if (!input) return true;
        
        // Fill our analysis buffer
        for (let i = 0; i < input.length; i++) {
            this.buffer[this.bufferIndex] = input[i];
            this.bufferIndex++;
            
            // When the buffer is full, analyze it
            if (this.bufferIndex === this.bufferSize) {
                // We'll just pass the raw buffer to the main thread
                // The actual analysis happens there to avoid thread limitations
                this.port.postMessage({
                    type: 'audioData',
                    buffer: this.buffer.slice()
                });
                
                // Reset buffer position
                this.bufferIndex = 0;
            }
        }
        
        // Always return true to keep the processor alive
        return true;
    }
}

// Register the processor
registerProcessor('chord-processor', ChordProcessor);
