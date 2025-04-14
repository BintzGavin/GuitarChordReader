# Guitar Chord Reader 🎸

A real-time web application that listens through your device's microphone and displays the guitar chord being played. Perfect for practice sessions, songwriting, or learning new chords.

## Project Origin

This project was developed in one-shot in Replit, based on a comprehensive implementation plan for real-time acoustic guitar chord recognition. The entire application was bootstrapped from a detailed technical specification that covered everything from audio processing algorithms to user interface design. The implementation plan (available in `attached_assets/`) provides in-depth details about:

- Signal processing and chord detection approaches
- Frontend and backend architecture
- Performance optimization strategies
- Future expansion possibilities
- Technical considerations for real-time audio processing

The project demonstrates how a well structured implementation plan can be rapidly turned into a working application. The implementation plan itself was created by ChatGPT Deep Research. You can view the original ChatGPT conversation that generated this plan [here](https://chatgpt.com/share/67fd4f06-acd4-8006-aec2-d1f67e8da08c).

I knew little to nothing about audio processing, so I had NotebookLM generate a podcast based on a learning plan I generated in the above thread to help understand the concepts used. You can listen to the podcast here: 


https://github.com/user-attachments/assets/599fc1c4-f139-46b6-a8a7-7dbcc25e5a27


## Features

- Real-time acoustic guitar chord detection
- Low-latency local audio processing in the browser
- Support for basic major and minor chords
- Simple, intuitive interface
- Works on desktop and mobile browsers

## Getting Started

### Prerequisites

- Python 3.11 or higher
- A modern web browser (Chrome, Firefox, or Safari)
- A microphone
- An acoustic guitar

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/GuitarChordReader.git
cd GuitarChordReader
```

2. Create a virtual environment and activate it:

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows, use: venv\Scripts\activate
```

3. Install the required dependencies:

```bash
pip install -r requirements.txt
```

### Running the Application

1. Make sure your virtual environment is activated
2. Start the Flask development server:

```bash
python main.py
```

3. Open your web browser and navigate to:

```
http://localhost:5000
```

4. Allow microphone access when prompted
5. Start playing your guitar!

## How It Works

The application uses advanced audio processing techniques to detect guitar chords in real-time:

1. Captures audio input through your device's microphone
2. Processes the audio using the Web Audio API
3. Performs spectral analysis to identify the frequencies present
4. Maps these frequencies to musical notes
5. Matches the note combinations to known chord patterns
6. Displays the detected chord on screen

## Technical Details

- Built with Flask (Python) backend (Replit's choice, I didn't argue)
- Uses Web Audio API for real-time audio processing
- Implements FFT (Fast Fourier Transform) for frequency analysis
- Employs template matching for chord recognition
- Processes audio locally in the browser for minimal latency

## Browser Support

- Chrome (recommended)
- Firefox
- Safari 14+

Note: For best performance, use a modern browser with AudioWorklet support.

## Future Features

- Support for more complex chords (7th, suspended, etc.)
- Electric guitar support
- Chord progression recording
- Chord diagram display
- Mobile app version
- Offline support via PWA

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Implementation based on research in Music Information Retrieval (MIR)
- Uses concepts from digital signal processing and music theory
- Inspired by the need for a simple, accessible chord detection tool
