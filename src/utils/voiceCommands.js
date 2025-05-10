export function voiceCommands({ describeScene }) {
    const isSpeechRecognitionSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;
    let isAndroid = /android/i.test(navigator.userAgent);
    let restartAttempts = 0;
    const MAX_RESTART_ATTEMPTS = 3;
  
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
            } else if (event.error === 'no-speech') {
                // Don't restart on no-speech errors
                return;
            }
            
            // Only attempt to restart on certain errors
            if (['audio-capture', 'network', 'service-not-allowed'].includes(event.error)) {
                handleRestart();
            }
        };
  
        recognition.onend = () => {
            // Only restart if it wasn't explicitly stopped
            if (recognition && !recognition.explicitlyStopped) {
                handleRestart();
            }
        };

        const handleRestart = () => {
            if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
                console.warn('Max restart attempts reached, stopping recognition');
                return;
            }

            // Add delay before restarting to prevent rapid cycling
            setTimeout(() => {
                if (recognition) {
                    try {
                        recognition.start();
                        restartAttempts++;
                    } catch (e) {
                        console.warn('Failed to restart speech recognition:', e);
                    }
                }
            }, isAndroid ? 1000 : 100); // Longer delay for Android
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
                recognition.explicitlyStopped = true;
                recognition.stop();
            } catch (e) {
                console.warn('Error stopping speech recognition:', e);
            }
            recognition = null;
        }
    };
}