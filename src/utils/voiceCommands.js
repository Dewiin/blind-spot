// Track if we have microphone permission
let hasMicPermission = false;

export function voiceCommands({ describeScene }) {
  // Enhanced support detection
  const isSpeechRecognitionSupported = 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);
    
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;

  if (isSpeechRecognitionSupported) {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    const commandPatterns = [
      'describe the scene',
      'describe',
      'what\'s happening',
      'show me my blind spot',
      'guide me',
      'jarvis clip that'
    ];

    recognition.onresult = (event) => {
      // Count speech as user interaction
      document.dispatchEvent(new Event('speech'));
      
      const result = event.results[event.results.length - 1];
      if (result.isFinal) {
        const transcript = result[0].transcript.toLowerCase().trim();
        
        if (commandPatterns.some(pattern => transcript.includes(pattern))) {
          describeScene();
        }
      }
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Special handling for permission denied
      if (event.error === 'not-allowed') {
        hasMicPermission = false;
        console.warn('Microphone access denied');
        // On iOS, we might want to guide users to enable microphone in settings
        if (isIOS()) {
          speakText("Please enable microphone access in Settings to use voice commands");
        }
      }
      
      // Attempt to restart if not a permission error
      if (event.error !== 'not-allowed') {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Failed to restart speech recognition:', e);
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      // Auto-restart if we have permission
      if (hasMicPermission) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            console.warn('Failed to restart speech recognition:', e);
          }
        }, 500);
      }
    };

    // Start recognition with proper permission handling
    const startRecognition = () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        // Request microphone permission
        navigator.mediaDevices.getUserMedia({ audio: true })
          .then(() => {
            hasMicPermission = true;
            try {
              recognition.start();
            } catch (e) {
              console.warn('Failed to start recognition:', e);
            }
          })
          .catch(err => {
            console.warn('Microphone access denied:', err);
            hasMicPermission = false;
            
            // For iOS, guide users to enable microphone
            if (isIOS()) {
              speakText("Please enable microphone access in Settings to use voice commands");
            }
          });
      } else {
        // For browsers without modern permission API
        try {
          recognition.start();
          hasMicPermission = true;
        } catch (e) {
          console.warn('Failed to start recognition:', e);
          hasMicPermission = false;
        }
      }
    };

    // Start when we detect any user interaction
    const handleFirstInteraction = () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchstart', handleFirstInteraction);
      startRecognition();
    };

    // Listen for both click and touch events
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true });
    
  } else {
    console.warn('Speech recognition not supported in this browser');
    speakText("Voice commands are not supported in this browser");
  }

  return () => {
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.warn('Error stopping recognition:', e);
      }
    }
  };
}

// Shared iOS detection
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
         (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}