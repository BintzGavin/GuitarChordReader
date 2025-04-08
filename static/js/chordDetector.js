/**
 * Chord Detector
 * Analyzes chromagram data to detect guitar chords with advanced pattern recognition
 */
class ChordDetector {
    constructor() {
        // Define chord templates as chromagram patterns (normalized vectors)
        this.chordTemplates = {
            // Major chords
            'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'C#': [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'D': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            'D#': [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
            'E': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
            'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'F#': [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            'G#': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
            'A': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            'A#': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
            'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
            
            // Minor chords
            'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            'C#m': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
            'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'D#m': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0],
            'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'Fm': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'F#m': [0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            'Gm': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            'G#m': [0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1],
            'Am': [1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            'A#m': [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
            'Bm': [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            
            // Seventh chords (common ones for guitar)
            'G7': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            'C7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0],
            'D7': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
            'E7': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1],
            'A7': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1],
            
            // Major seventh chords
            'Cmaj7': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'Fmaj7': [1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0],
            'Gmaj7': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            
            // Sus2 and Sus4 chords
            'Asus2': [0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0],
            'Asus4': [0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1],
            'Dsus2': [0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            'Dsus4': [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0],
            'Esus2': [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1],
            'Esus4': [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1],
        };
        
        // Initialize tracking for chord consistency over time
        this.previousChroma = Array(12).fill(0);
        this.chordHistory = [];
        this.historyDepth = 3; // Number of previous chords to track
        this.confidenceThreshold = 0.55; // Min confidence to consider a chord valid
        this.noChordThreshold = 0.02; // Min chroma value to detect a valid note
        this.chromaticSmoothingFactor = 0.8; // How much to smooth chromagram over time
        this.contextWeighting = 0.2; // How much musical context affects detection
        
        // Add chord bias adjustment - we need to counter the over-detection of some chords
        this.chordBias = {
            // Reduce detection bias for these frequently over-detected chords
            'C7': -0.1,
            'Fmaj7': -0.2,
            'F': -0.08,
            // Boost detection for these frequently under-detected chords
            'Em': 0.12,
            'Am': 0.12,
            'G': 0.08,
            'E': 0.08,
            'D': 0.08
        };
        
        console.log("ChordDetector created successfully");
    }
    
    /**
     * Detect a chord from chromagram data with advanced music theory and acoustic modeling
     * @param {Array} chromagram 12-element array representing the chromagram
     * @param {number} volume Current audio volume (0-1)
     * @param {boolean} isNewStrum Whether this might be a new chord/strum (optional)
     * @returns {Object} Detected chord information (name, type, confidence)
     */
    detectChord(chromagram, volume, isNewStrum = false) {
        // Don't detect chords with not enough energy
        if (!chromagram || volume < 0.005) {
            return { name: "", type: "", confidence: 0, isStable: false };
        }
        
        console.log("ChordDetector received:", {
            chromagram,
            volume,
            isNewStrum
        });
        
        // Process chromagram with smoothing and normalization
        const cleanedChroma = this._getSmoothedChromagram(chromagram, isNewStrum);
        
        // Check if there's enough data for a chord (noise gate)
        // Check if there's enough harmonic content to be a chord
        const hasChordContent = cleanedChroma.some(v => v > this.noChordThreshold);
        if (!hasChordContent) {
            return { name: "", type: "", confidence: 0, isStable: false };
        }
        
        // Compare with chord templates to find matches
        const chordCandidates = [];
        
        for (const [chordName, template] of Object.entries(this.chordTemplates)) {
            // Calculate similarity using cosine similarity
            let similarity = this.cosineSimilarity(cleanedChroma, template);
            
            // Apply special rules for specific chords to compensate for acoustic anomalies
            similarity = this._applyChordSpecificRules(chordName, cleanedChroma, similarity);
            
            // Boost certain patterns that are commonly undercounted
            similarity = this._applyChordContextBoost(chordName, similarity);
            
            // Apply global bias adjustment to balance detection
            if (this.chordBias[chordName]) {
                similarity += this.chordBias[chordName];
            }
            
            chordCandidates.push({
                name: chordName,
                similarity
            });
        }
        
        // Sort candidates by similarity
        chordCandidates.sort((a, b) => b.similarity - a.similarity);
        
        // Get top candidates
        const topCandidate = chordCandidates[0];
        const secondCandidate = chordCandidates[1];
        
        // Handle ambiguity between close matches
        let finalChord = topCandidate;
        if (
            secondCandidate && 
            (topCandidate.similarity - secondCandidate.similarity < 0.1) &&
            topCandidate.similarity < 0.7
        ) {
            // If the top two candidates are close, use context and deeper analysis
            finalChord = this._resolveChordConflicts(topCandidate, secondCandidate, cleanedChroma);
        }
        
        // Calculate confidence (0-1)
        const confidence = this._calculateConfidence(finalChord.name, finalChord.similarity, cleanedChroma);
        
        // Update tracking for this detection
        this._updateChordHistory(finalChord.name, confidence);
        
        // Extract chord information for display
        const { displayName, type } = this._getChordInfo(finalChord.name);
        
        // Return the result
        const result = {
            name: displayName,
            type: type,
            confidence: confidence,
            // A chord is considered stable if confidence is high
            isStable: confidence > this.confidenceThreshold
        };
        
        console.log("Chord detected:", result);
        return result;
    }
    
    /**
     * Get smoothed chromagram with adaptive logic based on context 
     * @param {Array} currentChroma The current chromagram
     * @param {boolean} isNewStrum Whether this might be a new chord/strum
     * @returns {Array} The smoothed chromagram
     * @private
     */
    _getSmoothedChromagram(currentChroma, isNewStrum) {
        // Use a normalized copy to avoid modifying the original
        const normalizedChroma = [...currentChroma];
        
        // Apply temporal smoothing, but less if we detected a new strum
        const smoothingFactor = isNewStrum ? 0.4 : this.chromaticSmoothingFactor;
        
        // Blend with previous chromagram for stability
        const smoothedChroma = normalizedChroma.map((value, i) => 
            (value * (1 - smoothingFactor)) + (this.previousChroma[i] * smoothingFactor)
        );
        
        // Store for next time
        this.previousChroma = [...smoothedChroma];
        
        // Normalize again after smoothing for consistent comparison
        const chromaSum = smoothedChroma.reduce((sum, value) => sum + value, 0);
        if (chromaSum > 0) {
            for (let i = 0; i < smoothedChroma.length; i++) {
                smoothedChroma[i] /= chromaSum;
            }
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
        if (chordName === 'E') {
            // E chord should have strong E note (4) and B note (11), with G# (8)
            const hasStrongE = chromagram[4] > 0.55;  // Lowered from 0.65
            const hasB = chromagram[11] > 0.3;
            const hasGsharp = chromagram[8] > 0.2;
            
            if (hasStrongE && hasB) {
                similarity += 0.15;  // Increased from 0.1
                if (hasGsharp) similarity += 0.05; // Extra boost if third is present
            }
        } else if (chordName === 'Em') {
            // Em chord should have strong E note (4) and B note (11), with G (7)
            const hasStrongE = chromagram[4] > 0.45; // Lowered from 0.55 for better Em detection
            const hasB = chromagram[11] > 0.25;  // Lowered from 0.3
            const hasG = chromagram[7] > 0.15; // Minor third detection
            
            if (hasStrongE) {
                similarity += 0.15; // Increased from 0.12
                if (hasB) similarity += 0.08;  // Increased from 0.06
                if (hasG) similarity += 0.08; // Increased from 0.05 for minor third
            }
        }
        
        // Detailed handling for Fmaj7 vs C ambiguity
        if (chordName === 'Fmaj7') {
            // Fmaj7 needs strong F, A, C and E components with specific pattern
            const hasStrongF = chromagram[5] > 0.7;  // F
            const hasE = chromagram[4] > 0.5;  // E
            const hasA = chromagram[9] > 0.4;  // A
            const hasC = chromagram[0] > 0.3;  // C
            
            // If we have a very clear Fmaj7 pattern - but make it more strict
            if (hasStrongF && hasE && hasA && hasC) {
                similarity += 0.05; // Reduced from 0.08 to make it less sensitive
            } else if (hasStrongF && hasE) {
                similarity += 0.02; // Reduced from 0.04
            }
            
            // Additional check to prevent false positives on Fmaj7
            if (chromagram[5] < 0.55 || chromagram[4] < 0.4) {
                similarity -= 0.2; // Increased penalty from 0.15
            }
        } else if (chordName === 'C7') {
            // Penalize C7 detection unless it's very clear
            // C7 needs strong C, E, G and Bb components
            const hasStrongC = chromagram[0] > 0.7;  // C
            const hasE = chromagram[4] > 0.45;  // E
            const hasG = chromagram[7] > 0.45;  // G
            const hasBb = chromagram[10] > 0.4; // Bb (minor seventh)
            
            // If it's missing key components, penalize heavily
            if (!hasStrongC || !hasBb) {
                similarity -= 0.15;
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
                similarity -= 0.15; // Increased penalty
            }
        } else if (chordName === 'G') {
            // G needs strong G, B, D components
            const hasStrongG = chromagram[7] > 0.6; // G (lowered from 0.65)
            const hasB = chromagram[11] > 0.35; // B (lowered from 0.4)
            const hasD = chromagram[2] > 0.35;  // D (lowered from 0.4)
            
            if (hasStrongG) {
                similarity += 0.09; // Increased from 0.07
                if (hasB && hasD) similarity += 0.07; // Increased from 0.04 for all three notes
            }
        } else if (chordName === 'D') {
            // D needs strong D, F#, A components
            const hasStrongD = chromagram[2] > 0.6; // D (lowered from 0.65)
            const hasFsharp = chromagram[6] > 0.35; // F# (lowered from 0.4)
            const hasA = chromagram[9] > 0.35;  // A (lowered from 0.4)
            
            if (hasStrongD) {
                similarity += 0.09; // Increased from 0.07
                if (hasFsharp && hasA) similarity += 0.07; // Increased from 0.04 for all three
            }
        } else if (chordName === 'Am') {
            // Am needs strong A, C, E components
            const hasStrongA = chromagram[9] > 0.5; // A (lowered from 0.55)
            const hasC = chromagram[0] > 0.25;  // C (lowered from 0.3)
            const hasE = chromagram[4] > 0.25;  // E (lowered from 0.3)
            
            if (hasStrongA) {
                similarity += 0.15; // Increased from 0.1
                if (hasC) similarity += 0.06; // Increased from 0.05
                if (hasE) similarity += 0.06; // Increased from 0.05
            }
        }
        
        // Add other chord-specific rules here...
        
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
        // Look at recent chord history for context-aware boosting
        if (this.chordHistory.length === 0) {
            return similarity; // No history yet
        }
        
        const recentChord = this.chordHistory[this.chordHistory.length - 1].name;
        
        // Slight boost for chord repetition (stability)
        if (chordName === recentChord) {
            similarity += 0.03;
        }
        
        // Slight boost for common chord progressions
        if (this._isValidChordTransition(recentChord, chordName)) {
            similarity += this.contextWeighting;
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
        // Handle specific ambiguities with detailed analysis
        // Common ambiguities: major/minor, major/7th, add/sus variants
        
        const areRelated = (
            // Check if one is minor variant of the other
            (topCandidate.name === secondCandidate.name + 'm') ||
            (secondCandidate.name === topCandidate.name + 'm') ||
            // Check if one is seventh variant
            (topCandidate.name === secondCandidate.name + '7') ||
            (secondCandidate.name === topCandidate.name + '7')
        );
        
        if (areRelated) {
            // For related chord types, use specific rules
            
            // Check for minor vs major (look for third)
            if (topCandidate.name.endsWith('m') && !secondCandidate.name.endsWith('m')) {
                // Check for minor third presence
                const rootIndex = this._getNoteIndex(topCandidate.name.replace('m', ''));
                const minorThirdIndex = (rootIndex + 3) % 12;
                const majorThirdIndex = (rootIndex + 4) % 12;
                
                if (chromagram[minorThirdIndex] > chromagram[majorThirdIndex] * 1.2) {
                    return topCandidate; // Favor minor
                } else if (chromagram[majorThirdIndex] > chromagram[minorThirdIndex] * 1.2) {
                    return secondCandidate; // Favor major
                }
            }
            
            // For seventh chords, look for the seventh interval
            if (topCandidate.name.endsWith('7') || topCandidate.name.endsWith('maj7')) {
                const rootIndex = this._getNoteIndex(topCandidate.name.replace('7', '').replace('maj', ''));
                const seventhIndex = (rootIndex + 10) % 12; // Minor seventh
                const majSeventhIndex = (rootIndex + 11) % 12; // Major seventh
                
                if (topCandidate.name.endsWith('maj7') && chromagram[majSeventhIndex] > 0.15) {
                    return topCandidate; // Favor major seventh
                } else if (topCandidate.name.endsWith('7') && chromagram[seventhIndex] > 0.15) {
                    return topCandidate; // Favor dominant seventh
                }
            }
        }
        
        // Special case for commonly confused chords
        if ((topCandidate.name === 'F' && secondCandidate.name === 'Fmaj7') ||
            (topCandidate.name === 'Fmaj7' && secondCandidate.name === 'F')) {
            // Check if E note is strong, which would indicate Fmaj7
            if (chromagram[4] > 0.5) {
                return { name: 'Fmaj7', similarity: secondCandidate.similarity };
            } else {
                return { name: 'F', similarity: secondCandidate.similarity };
            }
        }
        
        // C7 vs C check - C7 needs a strong Bb
        if ((topCandidate.name === 'C7' && secondCandidate.name === 'C') ||
            (topCandidate.name === 'C' && secondCandidate.name === 'C7')) {
            // Check for strong Bb which would indicate C7
            if (chromagram[10] > 0.45) {
                return { name: 'C7', similarity: secondCandidate.similarity };
            } else {
                return { name: 'C', similarity: secondCandidate.similarity };
            }
        }
        
        // If no special resolution applied, stick with the top candidate
        return topCandidate;
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
        // Base confidence from similarity score
        let confidence = similarity;
        
        // Look at chord history for stability bonus
        const historyBoost = this.chordHistory.filter(c => c.name === chordName).length / this.historyDepth;
        confidence += historyBoost * 0.1;
        
        // Check if clear peaks match expected chord notes
        const rootIndex = this._getNoteIndex(chordName.replace('m', '').replace('7', '').replace('maj', ''));
        
        // Find peaks in chromagram
        const threshold = Math.max(...chromagram) * 0.7;
        const peaks = chromagram.map((value, index) => value > threshold ? index : -1).filter(i => i !== -1);
        
        // Expected notes for this chord
        const expectedNotes = this._getExpectedNotes(chordName);
        
        // Count how many peaks match expected notes
        const matchingPeaks = peaks.filter(peak => expectedNotes.includes(peak)).length;
        if (peaks.length > 0) {
            // Add bonus for matching peaks
            confidence += (matchingPeaks / peaks.length) * 0.1;
        }
        
        // Cap confidence at 0.95 to account for uncertainty
        return Math.min(0.95, confidence);
    }
    
    /**
     * Update the chord history tracking
     * @param {string} chordName The detected chord
     * @param {number} score The confidence score
     * @private
     */
    _updateChordHistory(chordName, score) {
        if (score >= this.confidenceThreshold && chordName) {
            // Add to history
            this.chordHistory.push({
                name: chordName,
                score: score,
                timestamp: Date.now()
            });
            
            // Limit history size
            if (this.chordHistory.length > this.historyDepth) {
                this.chordHistory.shift();
            }
        }
    }
    
    /**
     * Check if a chord transition makes musical sense
     * @param {string} fromChord The previous chord
     * @param {string} toChord The new chord
     * @returns {boolean} Whether the transition is valid 
     * @private
     */
    _isValidChordTransition(fromChord, toChord) {
        // Create maps for common chord progressions
        const commonProgressions = {
            'C': ['F', 'G', 'Am', 'Em'],
            'F': ['C', 'Bb', 'Dm', 'Gm'],
            'G': ['C', 'Em', 'Am', 'D'],
            'Am': ['F', 'C', 'G', 'Em'],
            'Em': ['C', 'G', 'Am', 'D'],
            'D': ['G', 'A', 'Bm', 'Em'],
            'A': ['D', 'E', 'F#m', 'Bm'],
            'E': ['A', 'B', 'C#m', 'F#m']
        };
        
        // Remove any 7, maj7, etc. for simplified progression checking
        const fromBase = fromChord.replace(/7|maj7|sus[24]/, '');
        const toBase = toChord.replace(/7|maj7|sus[24]/, '');
        
        // Check if this is a common progression
        if (commonProgressions[fromBase] && commonProgressions[fromBase].includes(toBase)) {
            return true;
        }
        
        return false;
    }
    
    /**
     * Get chord info including display name and type
     * @param {string} chordName The chord name
     * @returns {Object} Chord display info
     * @private
     */
    _getChordInfo(chordName) {
        // Parse chord name to get display elements
        let displayName = chordName;
        let type = '';
        
        // Handle minor chords
        if (chordName.endsWith('m')) {
            displayName = chordName.slice(0, -1);
            type = 'Minor';
        }
        // Handle seventh chords
        else if (chordName.endsWith('maj7')) {
            displayName = chordName.slice(0, -4);
            type = 'Major 7';
        }
        else if (chordName.endsWith('7')) {
            displayName = chordName.slice(0, -1);
            type = 'Dominant 7';
        }
        // Handle sus chords
        else if (chordName.endsWith('sus2')) {
            displayName = chordName.slice(0, -4);
            type = 'Sus2';
        }
        else if (chordName.endsWith('sus4')) {
            displayName = chordName.slice(0, -4);
            type = 'Sus4';
        }
        // Major is the default
        else {
            type = 'Major';
        }
        
        return { displayName, type };
    }
    
    /**
     * Get the chromatic index of a note
     * @param {string} noteName The note name
     * @returns {number} The chromatic index (0-11)
     * @private
     */
    _getNoteIndex(noteName) {
        const noteMap = {
            'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 
            'E': 4, 'F': 5, 'F#': 6, 'G': 7, 
            'G#': 8, 'A': 9, 'A#': 10, 'B': 11
        };
        
        return noteMap[noteName] || 0;
    }
    
    /**
     * Get expected note indices for a chord
     * @param {string} chordName The chord name
     * @returns {Array} Array of expected note indices
     * @private
     */
    _getExpectedNotes(chordName) {
        const root = this._getNoteIndex(chordName.replace('m', '').replace('7', '').replace('maj', ''));
        
        // Define note patterns for different chord types
        if (chordName.endsWith('m')) {
            // Minor: root, minor third, fifth
            return [root, (root + 3) % 12, (root + 7) % 12];
        } else if (chordName.endsWith('maj7')) {
            // Major seventh: root, major third, fifth, major seventh
            return [root, (root + 4) % 12, (root + 7) % 12, (root + 11) % 12];
        } else if (chordName.endsWith('7')) {
            // Dominant seventh: root, major third, fifth, minor seventh
            return [root, (root + 4) % 12, (root + 7) % 12, (root + 10) % 12];
        } else if (chordName.endsWith('sus2')) {
            // Sus2: root, major second, fifth
            return [root, (root + 2) % 12, (root + 7) % 12];
        } else if (chordName.endsWith('sus4')) {
            // Sus4: root, perfect fourth, fifth
            return [root, (root + 5) % 12, (root + 7) % 12];
        } else {
            // Major: root, major third, fifth
            return [root, (root + 4) % 12, (root + 7) % 12];
        }
    }
    
    /**
     * Calculate cosine similarity between two vectors
     * @param {Array} a First vector
     * @param {Array} b Second vector
     * @returns {number} Cosine similarity (-1 to 1)
     */
    cosineSimilarity(a, b) {
        if (!a || !b || a.length !== b.length) {
            return 0;
        }
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        
        // Handle zero vectors
        if (normA === 0 || normB === 0) {
            return 0;
        }
        
        // Return cosine similarity
        return dotProduct / (normA * normB);
    }
}
