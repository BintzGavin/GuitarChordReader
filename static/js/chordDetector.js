/**
 * Chord Detector
 * Analyzes chromagram data to detect guitar chords with advanced pattern recognition
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
            
            // 7th chords with more accuracy
            'C7': { type: 'Dominant 7', template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0] },
            'D7': { type: 'Dominant 7', template: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1] },
            'E7': { type: 'Dominant 7', template: [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1] },
            'G7': { type: 'Dominant 7', template: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 1] },
            'A7': { type: 'Dominant 7', template: [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1] },
            
            // Major 7th chords
            'Cmaj7': { type: 'Major 7', template: [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1] },
            'Dmaj7': { type: 'Major 7', template: [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0] },
            'Fmaj7': { type: 'Major 7', template: [1, 0, 0, 0, 0.6, 1, 0, 0, 0, 0.7, 0, 0.8] }, // F Major 7th (F, A, C, E)
            'Gmaj7': { type: 'Major 7', template: [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1] },
            
            // Minor 7th chords
            'Am7': { type: 'Minor 7', template: [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1] },
            'Em7': { type: 'Minor 7', template: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1] },
            'Dm7': { type: 'Minor 7', template: [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0] },
            
            // Sus chords
            'Dsus4': { type: 'Sus4', template: [0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0] },
            'Esus4': { type: 'Sus4', template: [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1] },
            'Asus4': { type: 'Sus4', template: [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1] },
            'Asus2': { type: 'Sus2', template: [0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 0] },
        };
        
        // Common acoustic guitar chord voicings with more precise templates based on harmonic analysis
        this.acousticGuitarTemplates = {
            // Open chord shapes on acoustic guitar with detailed frequency profiles
            'C': { type: 'Major', template: [3.5, 0, 0, 0, 2.2, 0, 0, 3.8, 0, 0, 0, 1.2] }, // E, G, and C emphasized
            'D': { type: 'Major', template: [0, 0, 4.5, 0, 0, 0, 3.2, 0, 0, 2.5, 0, 0] }, // D with F# and A
            'Dm': { type: 'Minor', template: [0, 0, 4.5, 0, 0, 3.2, 0, 0, 0, 2.5, 0, 0] }, // D minor with F and A
            'E': { type: 'Major', template: [0, 0, 0, 0, 7.2, 0, 0, 0, 4.5, 0, 0, 2.8] }, // E, B, and G# with strong root
            'G': { type: 'Major', template: [0, 0, 2.2, 0, 0, 0, 2.4, 5.5, 0, 0, 0, 3.2] }, // G, D, and B with strong G 
            'A': { type: 'Major', template: [0, 1.2, 0, 0, 3.2, 0, 0, 0, 0, 2.8, 0, 0] }, // A and E emphasized
            
            'Em': { type: 'Minor', template: [0, 0, 0, 0, 6.5, 0, 0, 3.2, 0, 0, 0, 2.4] }, // E, B, and G emphasized
            'Am': { type: 'Minor', template: [3.2, 0, 0, 0, 4.5, 0, 0, 0, 0, 2.8, 0, 0] }, // A and E emphasized with C
            
            // Extended and special chords with more accurate harmonic profiles
            'Fmaj7': { type: 'Major 7', template: [2.5, 0, 0, 0, 1.2, 2.8, 0, 0, 0, 1.5, 0, 1.2] }, // F, A, C, E 
            'G7': { type: 'Dominant 7', template: [0, 0, 2.6, 0, 0, 0, 0, 4.8, 0, 0, 1.8, 3.0] }, // G, D, F, B
            'E7': { type: 'Dominant 7', template: [0, 0, 0, 0, 6.8, 0, 0, 0, 3.8, 0, 3.2, 2.4] }, // E, G#, D, B
            'Am7': { type: 'Minor 7', template: [3.0, 0, 0, 0, 3.8, 0, 0, 0, 0, 2.6, 0, 1.8] }, // A, C, E, G
            'Dsus4': { type: 'Sus4', template: [0, 0, 4.2, 0, 0, 0, 0, 2.8, 0, 3.0, 0, 0] }, // D, G, A
        };
        
        // Combine templates, with acoustic templates taking precedence for better real-world accuracy
        this.templates = { ...this.chordTemplates, ...this.acousticGuitarTemplates };
        
        // Advanced state tracking for better stability
        this.previousChord = '';
        this.chordStability = 0;
        this.noChordFrames = 0;
        this.chordConfidenceHistory = {}; // Track confidence values for recent chords
        this.chordCountThisSession = {}; // Count detections of each chord type
        this.totalChordDetections = 0; // Total number of chord detections
        
        // Advanced settings for better chord detection
        this.minVolumeThreshold = 0.01; // Keep this low to catch quieter playing
        this.stabilityThreshold = 5; // Lowered to make faster transitions with the improved processing
        this.noiseFloor = 0.12; // Lowered to capture more harmonic content with better noise filtering
        this.chordDecayTime = 10; // Frames to keep showing previous chord after silence
        this.detectionMemory = 30; // Frames to remember chord confidence in history
        
        // Improved chromagram smoothing
        this.prevChromagrams = [];
        this.chromagramSmoothingFrames = 3; // Number of frames to use for smoothing
        
        // More sophisticated chord penalties to adjust for over-detection
        // Calibrated with the new processing pipeline
        this.chordPenalties = {
            'F': 0.13,  // Penalize F chord which is over-detected
            'F#': 0.09, // Slight penalty for F#
            'C#': 0.07, // Slight penalty for C#
            'Em': 0.10, // Penalize Em which got falsely detected (reduced since improved processing)
            'Fmaj7': 0.12, // Penalize Fmaj7 to prevent over-detection (reduced with better detection)
            'C': 0.06,  // Slight penalty for C (reduced with better harmonic processing)
            'G#': 0.08, // Penalty for G# which can be falsely detected
            'A#': 0.07  // Penalty for A# which can be falsely detected
        };
        
        // Chord precedence and relationship modeling
        this.chordRelationships = {
            // Common chord relationships in music theory weighted by strength of relationship
            'C': { 'F': 0.8, 'G': 0.9, 'Am': 0.7, 'Em': 0.5, 'Dm': 0.6 },
            'G': { 'C': 0.9, 'D': 0.7, 'Em': 0.8, 'Am': 0.5 },
            'D': { 'G': 0.8, 'A': 0.9, 'Bm': 0.6, 'Em': 0.6 },
            'A': { 'D': 0.9, 'E': 0.8, 'F#m': 0.6 },
            'E': { 'A': 0.9, 'B': 0.7, 'C#m': 0.6, 'Am': 0.5 },
            'Am': { 'C': 0.8, 'Dm': 0.7, 'E': 0.9, 'F': 0.6, 'G': 0.7 },
            'Em': { 'C': 0.7, 'G': 0.8, 'D': 0.7, 'Am': 0.6, 'B': 0.6 }
        };
    }

    /**
     * Detect a chord from chromagram data with advanced music theory and acoustic modeling
     * @param {Array} chromagram 12-element array representing the chromagram
     * @param {number} volume Current audio volume (0-1)
     * @param {boolean} isNewStrum Whether this might be a new chord/strum (optional)
     * @returns {Object} Detected chord information (name, type, confidence)
     */
    detectChord(chromagram, volume, isNewStrum = false) {
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
            
            // Return the previous chord with decreasing confidence during decay
            if (this.previousChord) {
                const decayFactor = Math.max(0, 1 - (this.noChordFrames / this.chordDecayTime));
                
                // Get the chord type from the template information
                const chordInfo = this._getChordInfo(this.previousChord);
                
                return {
                    name: chordInfo.displayName,
                    type: chordInfo.type,
                    confidence: 0.8 * decayFactor, // Higher starting confidence for stability
                    isStable: this.chordStability >= this.stabilityThreshold
                };
            }
            
            return { name: '', type: '', confidence: 0, isStable: false };
        }
        
        this.noChordFrames = 0;
        
        // If this is a new strum and we have an existing stable chord,
        // we'll be more likely to recognize chord changes (reset stability threshold)
        if (isNewStrum && this.chordStability >= this.stabilityThreshold) {
            this.chordStability = Math.floor(this.stabilityThreshold * 0.3);
        }
        
        // Store this chromagram for advanced smoothing
        this.prevChromagrams.push([...chromagram]);
        if (this.prevChromagrams.length > this.chromagramSmoothingFrames) {
            this.prevChromagrams.shift();
        }
        
        // Apply adaptive smoothing based on context
        const smoothedChroma = this._getSmoothedChromagram(chromagram, isNewStrum);
        
        // Normalize the chromagram more precisely
        const maxVal = Math.max(...smoothedChroma, 0.0001); // Avoid division by zero
        const normalizedChroma = smoothedChroma.map(val => val / maxVal);
        
        // Apply adaptive noise floor - zero out low values
        const dynamicNoiseFloor = isNewStrum ? this.noiseFloor * 0.8 : this.noiseFloor;
        const cleanedChroma = normalizedChroma.map(val => val < dynamicNoiseFloor ? 0 : val);
        
        // Store chord candidates with their scores for more sophisticated selection
        let chordCandidates = [];
        
        // Try each chord template with context-aware scoring
        for (const [chordName, chordInfo] of Object.entries(this.templates)) {
            const template = chordInfo.template;
            
            // Calculate primary similarity (cosine similarity between template and chromagram)
            let similarity = this.cosineSimilarity(cleanedChroma, template);
            
            // Apply basic penalty to over-detected chords
            if (this.chordPenalties[chordName]) {
                similarity -= this.chordPenalties[chordName];
            }
            
            // Advanced chord-specific detection logic
            similarity = this._applyChordSpecificRules(chordName, cleanedChroma, similarity);
            
            // Context-aware chord relationship boosting
            similarity = this._applyChordContextBoost(chordName, similarity);
            
            // Store this candidate
            chordCandidates.push({
                name: chordName,
                score: similarity,
                info: chordInfo
            });
        }
        
        // Sort chord candidates by score (highest first)
        chordCandidates.sort((a, b) => b.score - a.score);
        
        // Get top two candidates for potential conflict resolution
        const topCandidate = chordCandidates[0] || { name: '', score: 0, info: { type: '' } };
        const secondCandidate = chordCandidates[1] || { name: '', score: 0, info: { type: '' } };
        
        // Apply conflict resolution for ambiguous chord detections
        const resolvedChord = this._resolveChordConflicts(topCandidate, secondCandidate, cleanedChroma);
        let bestMatchChord = resolvedChord.name;
        let bestMatchScore = resolvedChord.score;
        
        // Update chord detection history
        this._updateChordHistory(bestMatchChord, bestMatchScore);
        
        // Check if the detected chord matches the previous one for stability tracking
        if (bestMatchChord === this.previousChord) {
            this.chordStability++;
        } else {
            // For new chord detections, apply additional validation
            if (this._isValidChordTransition(this.previousChord, bestMatchChord)) {
                this.chordStability = isNewStrum ? 2 : 0; // Give a small stability bonus on clear strums
                this.previousChord = bestMatchChord;
            } else {
                // If the transition seems implausible, require stronger evidence
                const stabilityNeeded = Math.min(3, this.chordStability);
                if (bestMatchScore > (topCandidate.score * 1.2) || isNewStrum) {
                    this.chordStability = 0;
                    this.previousChord = bestMatchChord;
                } else {
                    // Otherwise keep the previous chord until we're more confident
                    bestMatchChord = this.previousChord;
                    // But reduce stability to allow eventual changes
                    this.chordStability = Math.max(0, this.chordStability - 1);
                }
            }
        }
        
        // Calculate dynamic confidence based on multiple factors
        const chordInfo = this._getChordInfo(bestMatchChord);
        const confidence = this._calculateConfidence(bestMatchChord, bestMatchScore, cleanedChroma);
        
        return {
            name: chordInfo.displayName,
            type: chordInfo.type,
            confidence: confidence,
            isStable: this.chordStability >= this.stabilityThreshold
        };
    }
    
    /**
     * Get smoothed chromagram with adaptive logic based on context 
     * @param {Array} currentChroma The current chromagram
     * @param {boolean} isNewStrum Whether this might be a new chord/strum
     * @returns {Array} The smoothed chromagram
     * @private
     */
    _getSmoothedChromagram(currentChroma, isNewStrum) {
        // If we don't have enough frames for smoothing
        if (this.prevChromagrams.length < 2) {
            return [...currentChroma];
        }
        
        let smoothedChroma;
        
        if (isNewStrum) {
            // On new strums, give more weight to the current frame
            smoothedChroma = currentChroma.map((val, i) => {
                const prevVal = this.prevChromagrams[this.prevChromagrams.length - 2][i];
                return val * 0.85 + prevVal * 0.15; // Heavily weighted toward current frame
            });
        } else {
            // Otherwise adaptive weighted smoothing based on chord stability
            smoothedChroma = new Array(12).fill(0);
            let totalWeight = 0;
            
            // Number of frames to consider - use fewer if we're in a stable chord
            const framesUsed = this.chordStability >= this.stabilityThreshold ? 
                Math.min(2, this.prevChromagrams.length) : this.prevChromagrams.length;
            
            for (let i = 0; i < framesUsed; i++) {
                // Use reversed index to weight recent frames more
                const idx = this.prevChromagrams.length - 1 - i;
                // Exponential weighting with stronger recent emphasis
                const frameWeight = Math.pow(2.2, framesUsed - i - 1); 
                totalWeight += frameWeight;
                
                for (let j = 0; j < 12; j++) {
                    smoothedChroma[j] += this.prevChromagrams[idx][j] * frameWeight;
                }
            }
            
            // Normalize by total weight
            smoothedChroma = smoothedChroma.map(val => val / totalWeight);
        }
        
        return smoothedChroma;
    }
    
    /**
     * Apply chord-specific detection rules
     * @param {string} chordName The chord being evaluated
     * @param {Array} chromagram The processed chromagram
     * @param {number} similarity The initial similarity score
     * @returns {number} The adjusted similarity score
     * @private
     */
    _applyChordSpecificRules(chordName, chromagram, similarity) {
        // Special handling for E/Em which have unique acoustic properties
        if (chordName === 'E' || chordName === 'Em') {
            // E chord should have strong E note (4) and B note (11), with possible G# (8) or G (7)
            const hasStrongE = chromagram[4] > 0.7;
            const hasB = chromagram[11] > 0.3;
            const hasGorGsharp = (chordName === 'E' ? chromagram[8] > 0.2 : chromagram[7] > 0.2);
            
            if (hasStrongE && hasB) {
                similarity += 0.08;
                if (hasGorGsharp) similarity += 0.04; // Extra boost if third is present
            }
        }
        
        // Detailed handling for Fmaj7 vs C ambiguity
        if (chordName === 'Fmaj7') {
            // Fmaj7 needs strong F, A, C and E components with specific pattern
            const hasStrongF = chromagram[5] > 0.7;  // F
            const hasE = chromagram[4] > 0.5;  // E
            const hasA = chromagram[9] > 0.4;  // A
            const hasC = chromagram[0] > 0.3;  // C
            
            // If we have a very clear Fmaj7 pattern
            if (hasStrongF && hasE && hasA && hasC) {
                similarity += 0.12;
            } else if (hasStrongF && hasE) {
                similarity += 0.06;
            }
        } else if (chordName === 'C') {
            // C needs strong C, E, G components
            const hasStrongC = chromagram[0] > 0.65; // C
            const hasE = chromagram[4] > 0.4;  // E
            const hasG = chromagram[7] > 0.5;  // G
            
            if (hasStrongC && hasG) {
                similarity += 0.06;
                if (hasE) similarity += 0.05; // Extra boost for all three notes
            }
            
            // Penalize C when E and F are both very strong (likely Fmaj7)
            const hasStrongE = chromagram[4] > 0.7;
            const hasStrongF = chromagram[5] > 0.7;
            if (hasStrongE && hasStrongF && chromagram[0] < 0.6) {
                similarity -= 0.10;
            }
        } else if (chordName === 'G') {
            // G needs strong G, B, D components
            const hasStrongG = chromagram[7] > 0.65; // G
            const hasB = chromagram[11] > 0.4; // B
            const hasD = chromagram[2] > 0.4;  // D
            
            if (hasStrongG && (hasB || hasD)) {
                similarity += 0.07;
                if (hasB && hasD) similarity += 0.04; // Extra boost for all three notes
            }
        } else if (chordName === 'D') {
            // D needs strong D, F#, A components
            const hasStrongD = chromagram[2] > 0.65; // D
            const hasFsharp = chromagram[6] > 0.4; // F#
            const hasA = chromagram[9] > 0.4;  // A
            
            if (hasStrongD && (hasFsharp || hasA)) {
                similarity += 0.07;
                if (hasFsharp && hasA) similarity += 0.04; // Extra boost for all three
            }
        } else if (chordName === 'Am') {
            // Am needs strong A, C, E components
            const hasStrongA = chromagram[9] > 0.65; // A
            const hasC = chromagram[0] > 0.4;  // C
            const hasE = chromagram[4] > 0.4;  // E
            
            if (hasStrongA && (hasC || hasE)) {
                similarity += 0.07;
                if (hasC && hasE) similarity += 0.04; // Extra boost for all three
            }
        }
        
        return similarity;
    }
    
    /**
     * Apply context-based chord boosts based on music theory relationships
     * @param {string} chordName The chord being evaluated
     * @param {number} similarity The current similarity score
     * @returns {number} The adjusted similarity score
     * @private
     */
    _applyChordContextBoost(chordName, similarity) {
        // If we have a stable previous chord and chord relationship data
        if (this.previousChord && 
            this.chordStability >= 2 && 
            this.chordRelationships[this.previousChord]) {
            
            // Get relationship strength between previous chord and this one
            const relationshipStrength = this.chordRelationships[this.previousChord][chordName] || 0;
            
            // Apply a small boost based on music theory relationships
            // This helps prioritize chords that make musical sense in sequence
            if (relationshipStrength > 0) {
                // Scale the boost by relationship strength
                const boost = 0.03 * relationshipStrength;
                similarity += boost;
            }
        }
        
        // Consider frequency of chords played in this session
        // This helps prevent random outlier detections
        if (this.totalChordDetections > 10) {
            const chordFrequency = (this.chordCountThisSession[chordName] || 0) / this.totalChordDetections;
            
            if (chordFrequency > 0.1) {
                // Slight boost for commonly played chords in this session
                // This helps maintain consistency in a given playing session
                similarity += 0.02;
            }
        }
        
        return similarity;
    }
    
    /**
     * Resolve ambiguity between similar chord detections
     * @param {Object} topCandidate The top scoring chord candidate
     * @param {Object} secondCandidate The second scoring chord candidate
     * @param {Array} chromagram The chromagram data
     * @returns {Object} The resolved chord with score
     * @private
     */
    _resolveChordConflicts(topCandidate, secondCandidate, chromagram) {
        // If the scores are very close, we need more analysis
        const scoreDifference = topCandidate.score - secondCandidate.score;
        
        if (scoreDifference < 0.05 && secondCandidate.score > 0) {
            // These chords are ambiguous, need deeper analysis
            
            // Check specific tough chord pairs
            if ((topCandidate.name === 'C' && secondCandidate.name === 'Fmaj7') ||
                (topCandidate.name === 'Fmaj7' && secondCandidate.name === 'C')) {
                
                // Check with stricter rules for this specific ambiguity
                const cScore = topCandidate.name === 'C' ? topCandidate.score : secondCandidate.score;
                const fmaj7Score = topCandidate.name === 'Fmaj7' ? topCandidate.score : secondCandidate.score;
                
                // C should have strong C and G with moderate E
                const cStrength = (chromagram[0] * 1.5 + chromagram[7] * 1.2 + chromagram[4] * 0.8);
                
                // Fmaj7 should have strong F, moderate A and C, with present E
                const fMaj7Strength = (chromagram[5] * 1.5 + chromagram[9] * 0.9 + 
                                      chromagram[0] * 0.8 + chromagram[4] * 1.2);
                
                if (fMaj7Strength > cStrength * 1.1) {
                    return { name: 'Fmaj7', score: fmaj7Score + 0.03 };
                } else if (cStrength > fMaj7Strength * 1.1) {
                    return { name: 'C', score: cScore + 0.03 };
                }
            }
            
            // Similar analysis for other problematic chord pairs
            else if ((topCandidate.name === 'Em' && secondCandidate.name === 'G') ||
                    (topCandidate.name === 'G' && secondCandidate.name === 'Em')) {
                
                // Em has strong E, B and G notes
                const emStrength = (chromagram[4] * 1.5 + chromagram[11] * 1.2 + chromagram[7]);
                
                // G has strong G, B and D notes
                const gStrength = (chromagram[7] * 1.5 + chromagram[11] * 0.8 + 
                                 chromagram[2] * 1.2);
                
                if (gStrength > emStrength * 1.15) {
                    return { name: 'G', score: Math.max(topCandidate.score, secondCandidate.score) + 0.02 };
                } else if (emStrength > gStrength * 1.1) {
                    return { name: 'Em', score: Math.max(topCandidate.score, secondCandidate.score) + 0.02 };
                }
            }
            
            // If current chord is stable, prefer it in ambiguous cases
            if (this.previousChord === topCandidate.name && this.chordStability >= 2) {
                return { name: topCandidate.name, score: topCandidate.score + 0.04 };
            } else if (this.previousChord === secondCandidate.name && this.chordStability >= 2) {
                return { name: secondCandidate.name, score: secondCandidate.score + 0.04 };
            }
        }
        
        // Default: return the top candidate
        return { name: topCandidate.name, score: topCandidate.score };
    }
    
    /**
     * Calculate final confidence based on multiple factors
     * @param {string} chordName The detected chord name
     * @param {number} similarity The similarity score
     * @param {Array} chromagram The chromagram data
     * @returns {number} The final confidence value (0-1)
     * @private 
     */
    _calculateConfidence(chordName, similarity, chromagram) {
        // Determine adaptive threshold based on chord type
        let threshold = 0.5; // Default threshold
        
        // Special handling for specific chords that need different thresholds
        if (chordName === 'G') {
            threshold = 0.38; // More lenient for G
        } else if (chordName === 'E') {
            threshold = 0.40; // More lenient for E
        } else if (chordName === 'Em') {
            threshold = 0.42; // Stricter for Em to prevent false detections
        } else if (chordName === 'D') {
            threshold = 0.39; // More lenient for D
        } else if (chordName === 'Fmaj7') {
            threshold = 0.43; // Balanced for Fmaj7 with improved detection
        } else if (chordName === 'C') {
            threshold = 0.42; // Balanced for C
        } else if (chordName.endsWith('7')) {
            threshold = 0.45; // Seventh chords need stronger evidence
        } else if (chordName.includes('sus')) {
            threshold = 0.47; // Sus chords need stronger evidence
        }
        
        // Base confidence from similarity score
        const confidenceBase = Math.max(0, (similarity - threshold) * 2.2); // Scale to 0-1 range
        
        // Stability component 
        const stabilityFactor = Math.min(1, this.chordStability / this.stabilityThreshold);
        
        // Integrate historical confidence (memory)
        let historyFactor = 0;
        if (this.chordConfidenceHistory[chordName] && this.chordConfidenceHistory[chordName].length > 0) {
            // Average recent confidences for this chord
            const recentConfidences = this.chordConfidenceHistory[chordName];
            const avgConfidence = recentConfidences.reduce((sum, c) => sum + c, 0) / recentConfidences.length;
            historyFactor = avgConfidence * 0.5; // Weight historical consistency
        }
        
        // Weighted combination with most weight on current detection and stability
        let confidence = confidenceBase * 0.45 + stabilityFactor * 0.45 + historyFactor * 0.1;
        
        // Clamp to valid range
        confidence = Math.max(0, Math.min(1, confidence));
        
        return confidence;
    }
    
    /**
     * Update the chord history tracking
     * @param {string} chordName The detected chord
     * @param {number} score The confidence score
     * @private
     */
    _updateChordHistory(chordName, score) {
        // Initialize if needed
        if (!this.chordConfidenceHistory[chordName]) {
            this.chordConfidenceHistory[chordName] = [];
        }
        
        // Add the current score
        this.chordConfidenceHistory[chordName].push(score);
        
        // Limit history size
        if (this.chordConfidenceHistory[chordName].length > this.detectionMemory) {
            this.chordConfidenceHistory[chordName].shift();
        }
        
        // Update chord usage statistics
        this.chordCountThisSession[chordName] = (this.chordCountThisSession[chordName] || 0) + 1;
        this.totalChordDetections++;
    }
    
    /**
     * Check if a chord transition makes musical sense
     * @param {string} fromChord The previous chord
     * @param {string} toChord The new chord
     * @returns {boolean} Whether the transition is valid 
     * @private
     */
    _isValidChordTransition(fromChord, toChord) {
        // If we don't have a previous chord, any chord is valid
        if (!fromChord) return true;
        
        // Check if the chords are related in music theory
        if (this.chordRelationships[fromChord] && 
            this.chordRelationships[fromChord][toChord]) {
            return true;
        }
        
        // Check if it's the same chord with different extension/quality
        // e.g., C to Cmaj7, Am to Am7, etc.
        const fromRoot = fromChord.charAt(0);
        const toRoot = toChord.charAt(0);
        
        if (fromRoot === toRoot) {
            return true;
        }
        
        // Otherwise consider it valid, but will need more evidence
        return true;
    }
    
    /**
     * Get chord info including display name and type
     * @param {string} chordName The chord name
     * @returns {Object} Chord display info
     * @private
     */
    _getChordInfo(chordName) {
        if (!chordName) {
            return { displayName: '', type: '' };
        }
        
        let displayName = chordName;
        let type = 'Major';
        
        // First check if we have template info
        if (this.templates[chordName]) {
            type = this.templates[chordName].type;
            
            // Format the display name based on type
            if (type === 'Major') {
                displayName = chordName; // Keep as is
            } else if (type === 'Minor') {
                displayName = chordName.replace('m', '');
            } else if (type === 'Major 7') {
                displayName = chordName.replace('maj7', '');
            } else if (type === 'Dominant 7') {
                displayName = chordName.replace('7', '');
            } else if (type === 'Minor 7') {
                displayName = chordName.replace('m7', '').replace('m', '');
            } else if (type.startsWith('Sus')) {
                displayName = chordName.replace('sus', '');
            }
            
            return { displayName, type };
        }
        
        // Fallback parsing logic
        if (chordName.includes('maj7')) {
            displayName = chordName.replace('maj7', '');
            type = 'Major 7';
        } else if (chordName.includes('m7')) {
            displayName = chordName.replace('m7', '');
            type = 'Minor 7';
        } else if (chordName.endsWith('7')) {
            displayName = chordName.replace('7', '');
            type = 'Dominant 7';
        } else if (chordName.includes('m')) {
            displayName = chordName.replace('m', '');
            type = 'Minor';
        } else if (chordName.includes('sus4')) {
            displayName = chordName.replace('sus4', '');
            type = 'Sus4';
        } else if (chordName.includes('sus2')) {
            displayName = chordName.replace('sus2', '');
            type = 'Sus2';
        } else {
            displayName = chordName;
            type = 'Major';
        }
        
        return { displayName, type };
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
