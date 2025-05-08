export function voiceCommands({ describeScene }) {
    const isSpeechRecognitionSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (isSpeechRecognitionSupported) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';

        // Define command patterns
        const commandPatterns = [
            'describe the scene',
            'describe',
            'what\'s happening',
            'show me my blind spot',
            'guide me',
            'jarvis clip that'
        ];

        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            
            // Check if the transcript matches any of our command patterns
            if (commandPatterns.some(pattern => transcript.includes(pattern))) {
                describeScene();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'not-allowed') {
                console.warn('Microphone access denied');
            }
        };

        recognition.onend = () => {
            // Restart recognition if it ends unexpectedly
            if (recognition) {
                try {
                    recognition.start();
                } catch (e) {
                    console.warn('Failed to restart speech recognition:', e);
                }
            }
        };

        // Start recognition
        try {
            recognition.start();
        } catch (e) {
            console.warn('Failed to start speech recognition:', e);
        }
    } else {
        console.warn('Speech recognition not supported in this browser');
    }

    // Return cleanup function
    return () => {
        if (recognition) {
            try {
                recognition.stop();
            } catch (e) {
                console.warn('Error stopping speech recognition:', e);
            }
            recognition = null;
        }
    };
}
