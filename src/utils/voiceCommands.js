import { useEffect, useRef, useState } from 'react';

export const useVoiceCommands = (commands = []) => {
  const [isListening, setIsListening] = useState(false);
  const [isMicrophoneAvailable, setIsMicrophoneAvailable] = useState(true);
  const recognitionRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Initialize speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;

    // Configure recognition
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Handle results
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('')
        .toLowerCase();

      // Check for commands
      commands.forEach(({ command, callback }) => {
        if (typeof command === 'string') {
          if (transcript.includes(command.toLowerCase())) {
            callback(transcript);
          }
        } else if (command instanceof RegExp) {
          const match = transcript.match(command);
          if (match) {
            callback(...match.slice(1));
          }
        } else if (Array.isArray(command)) {
          command.forEach(cmd => {
            if (transcript.includes(cmd.toLowerCase())) {
              callback(cmd);
            }
          });
        }
      });
    };

    // Handle errors
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(event.error);
      
      if (event.error === 'not-allowed') {
        setIsMicrophoneAvailable(false);
      }
      
      // Restart recognition if it was interrupted
      if (isListening && event.error !== 'not-allowed') {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
        }
      }
    };

    // Handle end of recognition
    recognition.onend = () => {
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          console.error('Failed to restart recognition:', e);
        }
      }
    };

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [commands, isListening]);

  const startListening = async () => {
    if (!recognitionRef.current) return;

    try {
      await recognitionRef.current.start();
      setIsListening(true);
      setError(null);
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setError(e.message);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;

    try {
      recognitionRef.current.stop();
      setIsListening(false);
    } catch (e) {
      console.error('Failed to stop recognition:', e);
    }
  };

  return {
    startListening,
    stopListening,
    isListening,
    isMicrophoneAvailable,
    error
  };
};
