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
            'Fmaj7': { type: 'Major 7', template: [2, 0, 0, 0, 1, 2, 0, 0, 0, 1, 0, 2] }, // F Major 7th (F, A, C, E) - enhanced to be more distinct from C
        };
        
        // Common acoustic guitar chord voicings - adjusted templates based on typical harmonic content
        this.acousticGuitarTemplates = {
            // Open chord shapes on acoustic guitar often have certain notes emphasized
            'C': { type: 'Major', template: [3, 0, 0, 0, 2, 0, 0, 3, 0, 0, 0, 1] }, // E and G emphasized, some C overtone
            'D': { type: 'Major', template: [0, 0, 4, 0, 0, 0, 3, 0, 0, 2, 0, 0] }, // D with F# and A
            'Dm': { type: 'Minor', template: [0, 0, 4, 0, 0, 3, 0, 0, 0, 2, 0, 0] }, // Enhanced Dm with stronger D and F notes
            // Further enhanced E chord template with stronger emphasis on open string notes
            'E': { type: 'Major', template: [0, 0, 0, 0, 7, 0, 0, 0, 4, 0, 0, 2] }, // Very strong emphasis on root (E), with B and G#
            // Completely reworked G chord template for acoustic guitar - much stronger emphasis on G note
            'G': { type: 'Major', template: [0, 0, 2, 0, 0, 0, 2, 5, 0, 0, 0, 3] }, // Very strong G, with D and B support
            'A': { type: 'Major', template: [0, 1, 0, 0, 3, 0, 0, 0, 0, 2, 0, 0] }, // E, A emphasized
            
            'Em': { type: 'Minor', template: [0, 0, 0, 0, 6, 0, 0, 3, 0, 0, 0, 2] }, // Strongly enhanced E minor template
            'Am': { type: 'Minor', template: [3, 0, 0, 0, 4, 0, 0, 0, 0, 2, 0, 0] }, // Enhanced Am with stronger A and E
            'Fmaj7': { type: 'Major 7', template: [3, 0, 0, 0, 1, 4, 0, 0, 0, 2, 0, 2] }, // F Major 7th optimized for acoustic, more different from C
        };
        
        // Combine templates, with acoustic templates taking precedence
        this.templates = { ...this.chordTemplates, ...this.acousticGuitarTemplates };
        
        // State tracking
        this.previousChord = '';
        this.chordStability = 0;
        this.noChordFrames = 0;
        
        // Settings
        this.minVolumeThreshold = 0.01; // Keep this low to catch quieter playing
        this.stabilityThreshold = 6; // Higher stability requirement to reduce jumpiness
        this.noiseFloor = 0.15; // Lower to capture more harmonic content
        this.chordDecayTime = 8; // Frames to keep showing previous chord after silence
        
        // Previous chromagram data for smoothing
        this.prevChromagrams = [];
        this.chromagramSmoothingFrames = 3; // Number of frames to use for smoothing
        
        // Chord penalties to adjust for over-detection
        this.chordPenalties = {
            'F': 0.15,  // Penalize F chord which is over-detected
            'F#': 0.1,  // Slight penalty for F#
            'C#': 0.08, // Slight penalty for C#
            'Em': 0.12  // Penalize Em which gets falsely detected
        };
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
        
        // Store this chromagram for smoothing
        this.prevChromagrams.push([...chromagram]);
        if (this.prevChromagrams.length > this.chromagramSmoothingFrames) {
            this.prevChromagrams.shift();
        }
        
        // Apply smoothing if we have enough frames
        let smoothedChroma = [...chromagram];
        if (this.prevChromagrams.length === this.chromagramSmoothingFrames) {
            // Create a smoothed chromagram by averaging recent frames
            smoothedChroma = new Array(12).fill(0);
            
            for (let i = 0; i < 12; i++) {
                for (let j = 0; j < this.prevChromagrams.length; j++) {
                    smoothedChroma[i] += this.prevChromagrams[j][i];
                }
                smoothedChroma[i] /= this.prevChromagrams.length;
            }
        }
        
        // Normalize the chromagram
        const maxVal = Math.max(...smoothedChroma);
        const normalizedChroma = smoothedChroma.map(val => val / maxVal);
        
        // Apply noise floor - zero out low values
        const cleanedChroma = normalizedChroma.map(val => val < this.noiseFloor ? 0 : val);
        
        // Find best matching chord
        let bestMatchScore = -Infinity;
        let bestMatchChord = '';
        
        // Try each chord template with penalties applied
        for (const [chordName, chordInfo] of Object.entries(this.templates)) {
            const template = chordInfo.template;
            
            // Calculate cosine similarity between template and chromagram
            let similarity = this.cosineSimilarity(cleanedChroma, template);
            
            // Apply penalty to over-detected chords (especially F)
            if (this.chordPenalties[chordName]) {
                similarity -= this.chordPenalties[chordName];
            }
            
            // Special handling for E/Em - boost if certain patterns match
            // This helps with detection of these difficult chords
            if (chordName === 'E' || chordName === 'Em') {
                // E chord often has a strong E (4th index) and B (11th index) 
                if (cleanedChroma[4] > 0.7 && cleanedChroma[11] > 0.3) {
                    similarity += 0.1; // Boost similarity
                }
            }
            
            // Special handling for Fmaj7 vs C
            if (chordName === 'Fmaj7') {
                // Fmaj7 should have both F (index 5) and E (index 4) present
                if (cleanedChroma[5] > 0.5 && cleanedChroma[4] > 0.4) {
                    similarity += 0.12; // Boost Fmaj7 similarity when both F and E are present
                }
            } else if (chordName === 'C') {
                // Penalize C detection if there's a strong E note (suggesting Fmaj7)
                if (cleanedChroma[4] > 0.7 && cleanedChroma[5] > 0.4) {
                    similarity -= 0.1; // Decrease similarity for C when E and F are present
                }
            }
            
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
        
        // Adjust thresholds for specific chords that need more leniency
        let threshold = 0.5; // Default threshold
        
        // Special handling for specific chords
        if (bestMatchChord === 'G') {
            threshold = 0.40; // Much more lenient for G
        } else if (bestMatchChord === 'E') {
            threshold = 0.42; // More lenient for E
        } else if (bestMatchChord === 'Em') {
            threshold = 0.45; // Less lenient for Em to prevent false detections
        } else if (bestMatchChord === 'Dm') {
            threshold = 0.39; // More lenient for Dm
        } else if (bestMatchChord === 'D') {
            threshold = 0.41; // More lenient for D
        } else if (bestMatchChord === 'Fmaj7') {
            threshold = 0.43; // Special threshold for Fmaj7 to prevent confusion with C
        } else if (bestMatchChord === 'C' && this.prevChromagrams.length > 1) {
            // For C, check if there's evidence of an F or E note that would suggest Fmaj7 instead
            const hasENote = cleanedChroma[4] > 0.6; // Strong E note (idx 4)
            const hasFNote = cleanedChroma[5] > 0.6; // Strong F note (idx 5)
            if (hasENote && hasFNote) {
                threshold = 0.47; // Make C harder to detect when E and F are present together (suggesting Fmaj7)
            }
        }
        
        // Calculate base confidence from similarity score
        const confidenceBase = Math.max(0, (bestMatchScore - threshold) * 2.0); // Scale to 0-1 range
        
        // Calculate stability factor (how long we've seen this chord)
        const stabilityFactor = Math.min(1, this.chordStability / this.stabilityThreshold);
        
        // Weighted combination with more weight on stability for smoother transitions
        const confidence = confidenceBase * 0.4 + stabilityFactor * 0.6; // Stability has more weight now
        
        // Determine chord type and display name
        let displayName = bestMatchChord;
        let chordType = 'Major';
        
        if (bestMatchChord.includes('maj7')) {
            displayName = bestMatchChord.replace('maj7', '');
            chordType = 'Major 7';
        } else if (bestMatchChord.includes('m')) {
            displayName = bestMatchChord.replace('m', '');
            chordType = 'Minor';
        } else {
            displayName = bestMatchChord;
        }
        
        return {
            name: displayName,
            type: chordType,
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
