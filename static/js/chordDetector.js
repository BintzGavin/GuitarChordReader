/**
 * Chord Detector
 * Analyzes chromagram data to detect guitar chords
 */
class ChordDetector {
    constructor() {
        // Chord templates (normalized energy distribution for each chord)
        this.chordTemplates = {
            // Major chords
            'C': { type: 'Major', template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0] },
            'C#': { type: 'Major', template: [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0] },
            'D': { type: 'Major', template: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0] },
            'D#': { type: 'Major', template: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0] },
            'E': { type: 'Major', template: [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1] },
            'F': { type: 'Major', template: [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0] },
            'F#': { type: 'Major', template: [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0] },
            'G': { type: 'Major', template: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1] },
            'G#': { type: 'Major', template: [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0] },
            'A': { type: 'Major', template: [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0] },
            'A#': { type: 'Major', template: [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0] },
            'B': { type: 'Major', template: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1] },
            
            // Minor chords
            'Cm': { type: 'Minor', template: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0] },
            'C#m': { type: 'Minor', template: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0] },
            'Dm': { type: 'Minor', template: [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0] },
            'D#m': { type: 'Minor', template: [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0] },
            'Em': { type: 'Minor', template: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1] },
            'Fm': { type: 'Minor', template: [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0] },
            'F#m': { type: 'Minor', template: [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0] },
            'Gm': { type: 'Minor', template: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0] },
            'G#m': { type: 'Minor', template: [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1] },
            'Am': { type: 'Minor', template: [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0] },
            'A#m': { type: 'Minor', template: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0] },
            'Bm': { type: 'Minor', template: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
            
            // Add 7th chords, dominant 7ths, etc. as needed
        };
        
        // Common acoustic guitar chord voicings - adjusted templates based on typical harmonic content
        this.acousticGuitarTemplates = {
            // Open chord shapes on acoustic guitar often have certain notes emphasized
            'C': { type: 'Major', template: [3, 0, 0, 0, 2, 0, 0, 3, 0, 0, 0, 1] }, // E and G emphasized, some C overtone
            'D': { type: 'Major', template: [0, 0, 3, 0, 0, 0, 2, 0, 0, 3, 0, 0] }, // A and F# emphasized
            'E': { type: 'Major', template: [0, 0, 0, 0, 3, 0, 0, 0, 2, 0, 0, 3] }, // E, B emphasized
            // Enhanced G chord template - more weight on G and B, added weight on D (the 5th)
            'G': { type: 'Major', template: [0, 0, 3, 0, 0, 0, 0, 4, 0, 0, 0, 2] }, // Stronger G and B emphasis, added D
            'A': { type: 'Major', template: [0, 1, 0, 0, 3, 0, 0, 0, 0, 2, 0, 0] }, // E, A emphasized
            
            'Em': { type: 'Minor', template: [0, 0, 0, 0, 3, 0, 0, 2, 0, 0, 0, 1] }, // E emphasized, G and B
            'Am': { type: 'Minor', template: [2, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0] }, // A, E emphasized, some C
            'Dm': { type: 'Minor', template: [0, 0, 2, 0, 0, 3, 0, 0, 0, 1, 0, 0] }, // D, F emphasized
        };
        
        // Combine templates, with acoustic templates taking precedence
        this.templates = { ...this.chordTemplates, ...this.acousticGuitarTemplates };
        
        // State tracking
        this.previousChord = '';
        this.chordStability = 0;
        this.noChordFrames = 0;
        
        // Settings
        this.minVolumeThreshold = 0.015; // Slightly higher to avoid false triggers
        this.stabilityThreshold = 3; // Increased for more stability
        this.noiseFloor = 0.2; // Lower threshold to capture more notes
        this.chordDecayTime = 12; // Frames to keep showing previous chord after silence
    }

    /**
     * Detect a chord from chromagram data
     * @param {Array} chromagram 12-element array representing the chromagram
     * @param {number} volume Current audio volume (0-1)
     * @returns {Object} Detected chord information (name, type, confidence)
     */
    detectChord(chromagram, volume) {
        // Handle low volume
        if (volume < this.minVolumeThreshold) {
            this.noChordFrames++;
            
            // Return no chord only after significant silence
            if (this.noChordFrames > this.chordDecayTime) {
                this.previousChord = '';
                this.chordStability = 0;
                return { 
                    name: '', 
                    type: '', 
                    confidence: 0,
                    isStable: false
                };
            }
            
            // Return the previous chord with decreasing confidence
            // This creates a smoother transition when stopping playing
            if (this.previousChord) {
                const decayFactor = Math.max(0, 1 - (this.noChordFrames / this.chordDecayTime));
                return {
                    name: this.previousChord.split('m')[0], // Remove 'm' suffix if present
                    type: this.previousChord.includes('m') ? 'Minor' : 'Major',
                    confidence: 0.7 * decayFactor, // Higher starting confidence for stability
                    isStable: this.chordStability >= this.stabilityThreshold
                };
            }
            
            return { name: '', type: '', confidence: 0, isStable: false };
        }
        
        this.noChordFrames = 0;
        
        // Normalize the chromagram further (sometimes helpful)
        const maxVal = Math.max(...chromagram);
        const normalizedChroma = chromagram.map(val => val / maxVal);
        
        // Apply noise floor - zero out low values
        const cleanedChroma = normalizedChroma.map(val => val < this.noiseFloor ? 0 : val);
        
        // Find best matching chord
        let bestMatchScore = -Infinity;
        let bestMatchChord = '';
        
        // Try each chord template
        for (const [chordName, chordInfo] of Object.entries(this.templates)) {
            const template = chordInfo.template;
            
            // Calculate cosine similarity between template and chromagram
            const similarity = this.cosineSimilarity(cleanedChroma, template);
            
            // Find the best match
            if (similarity > bestMatchScore) {
                bestMatchScore = similarity;
                bestMatchChord = chordName;
            }
        }
        
        // Check if the detected chord matches the previous one
        if (bestMatchChord === this.previousChord) {
            this.chordStability++;
        } else {
            this.chordStability = 0;
            this.previousChord = bestMatchChord;
        }
        
        // Calculate confidence based on similarity score and stability
        
        // Adjust threshold for G chord specifically (more lenient)
        const threshold = bestMatchChord === 'G' ? 0.45 : 0.5;
        
        // Calculate base confidence from similarity score
        const confidenceBase = Math.max(0, (bestMatchScore - threshold) * 2.0); // Scale to 0-1 range
        
        // Calculate stability factor (how long we've seen this chord)
        const stabilityFactor = Math.min(1, this.chordStability / this.stabilityThreshold);
        
        // Weighted combination with more weight on stability for smoother transitions
        const confidence = confidenceBase * 0.4 + stabilityFactor * 0.6; // Stability has more weight now
        
        return {
            name: bestMatchChord.replace('m', ''), // Remove 'm' suffix for display
            type: bestMatchChord.includes('m') ? 'Minor' : 'Major',
            confidence: confidence,
            isStable: this.chordStability >= this.stabilityThreshold
        };
    }
    
    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} a First vector
     * @param {Array} b Second vector
     * @returns {number} Cosine similarity (-1 to 1)
     */
    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        if (normA === 0 || normB === 0) return 0;
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}
