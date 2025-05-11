import { useState, useCallback, useEffect, useRef } from 'react';

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSafari, setIsSafari] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const audioContextRef = useRef(null);
  const voicesLoadedRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const utteranceQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);

  // Detect Safari and iOS
  useEffect(() => {
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsSafari(isSafariBrowser);
    setIsIOS(isIOSDevice);
  }, []);

  // Initialize audio context for Safari/iOS
  useEffect(() => {
    if ((isSafari || isIOS) && !audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
      
      // Resume audio context on any user interaction
      const resumeAudioContext = async () => {
        if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
          try {
            await audioContextRef.current.resume();
            hasUserInteractedRef.current = true;
          } catch (e) {
            console.error('Failed to resume audio context:', e);
          }
        }
      };

      // Add event listeners for user interaction
      document.addEventListener('click', resumeAudioContext);
      document.addEventListener('touchstart', resumeAudioContext);
      
      return () => {
        document.removeEventListener('click', resumeAudioContext);
        document.removeEventListener('touchstart', resumeAudioContext);
      };
    }
  }, [isSafari, isIOS]);

  // Load available voices with improved Safari/iOS handling
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        voicesLoadedRef.current = true;
        
        // Try to find a female English voice by default
        const preferredVoice = availableVoices.find(
          voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
        ) || availableVoices[0];
        
        setSelectedVoice(preferredVoice);
      }
    };

    // Handle voice loading differently for Safari/iOS
    if (isSafari || isIOS) {
      // Safari/iOS needs multiple attempts to load voices
      let attempts = 0;
      const maxAttempts = 10;
      
      const attemptLoadVoices = () => {
        loadVoices();
        if (!voicesLoadedRef.current && attempts < maxAttempts) {
          attempts++;
          setTimeout(attemptLoadVoices, 500); // Increased delay for iOS
        }
      };
      
      // Initial attempt
      attemptLoadVoices();
      
      // Also listen for voiceschanged event
      window.speechSynthesis.onvoiceschanged = loadVoices;
    } else {
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      loadVoices();
    }
  }, [isSafari, isIOS]);

  // Process utterance queue
  const processQueue = useCallback(() => {
    if (isProcessingQueueRef.current || utteranceQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    const utterance = utteranceQueueRef.current[0];

    utterance.onend = () => {
      console.log('Queue item completed');
      utteranceQueueRef.current.shift();
      isProcessingQueueRef.current = false;
      if (utteranceQueueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      utteranceQueueRef.current.shift();
      isProcessingQueueRef.current = false;
      if (utteranceQueueRef.current.length > 0) {
        processQueue();
      } else {
        setIsSpeaking(false);
      }
    };

    // For iOS, we need to ensure the audio context is running
    if (isIOS && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      console.log('Resuming audio context for iOS');
      audioContextRef.current.resume().then(() => {
        console.log('Audio context resumed, speaking now');
        window.speechSynthesis.speak(utterance);
      }).catch(error => {
        console.error('Failed to resume audio context:', error);
      });
    } else {
      console.log('Speaking without audio context resume');
      window.speechSynthesis.speak(utterance);
    }
  }, [isIOS]);

  // Initialize audio context on user interaction
  const initializeAudioContext = useCallback(async () => {
    if ((isSafari || isIOS) && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        hasUserInteractedRef.current = true;
      } catch (e) {
        console.error('Failed to resume audio context:', e);
      }
    }
  }, [isSafari, isIOS]);

  const speak = useCallback(async (text, options = {}) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      alert('Speech synthesis not supported on this device');
      return;
    }

    console.log('Speech attempt:', { isIOS, hasUserInteracted: hasUserInteractedRef.current, text });
    alert('Attempting to speak: ' + text); // Temporary debug alert

    // For iOS, ensure we have user interaction
    if (isIOS && !hasUserInteractedRef.current) {
      console.warn('Speech synthesis requires user interaction on iOS');
      alert('Please tap the screen first to enable speech');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    utteranceQueueRef.current = [];
    isProcessingQueueRef.current = false;

    // For Safari/iOS, ensure audio context is running
    if (isSafari || isIOS) {
      try {
        await initializeAudioContext();
        // Force a small test utterance to ensure speech is working
        const testUtterance = new SpeechSynthesisUtterance('Testing speech');
        testUtterance.onstart = () => {
          console.log('Test utterance started');
          alert('Test speech started'); // Temporary debug alert
        };
        testUtterance.onend = () => {
          console.log('Test utterance completed');
          alert('Test speech completed'); // Temporary debug alert
        };
        testUtterance.onerror = (event) => {
          console.error('Test utterance error:', event);
          alert('Test speech error: ' + event.error); // Temporary debug alert
        };
        window.speechSynthesis.speak(testUtterance);
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
        alert('Failed to initialize audio: ' + error.message); // Temporary debug alert
      }
    }

    // Split text into chunks for better handling
    const chunks = text.match(/[^.!?]+[.!?]+/g) || [text];

    // Create utterances for each chunk
    chunks.forEach(chunk => {
      const utterance = new SpeechSynthesisUtterance(chunk);
      
      // Apply voice settings
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = options.rate || 1.10;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      // Add debug logging for iOS
      if (isIOS) {
        utterance.onstart = () => {
          console.log('Utterance started:', chunk);
          alert('Started speaking: ' + chunk); // Temporary debug alert
        };
        utterance.onend = () => {
          console.log('Utterance ended:', chunk);
          alert('Finished speaking: ' + chunk); // Temporary debug alert
        };
        utterance.onerror = (event) => {
          console.error('Utterance error:', event, chunk);
          alert('Speech error: ' + event.error); // Temporary debug alert
        };
      }

      utteranceQueueRef.current.push(utterance);
    });

    setIsSpeaking(true);

    // Start processing the queue
    if (isSafari || isIOS) {
      // Add a longer delay for Safari/iOS
      setTimeout(() => {
        console.log('Starting speech queue processing');
        alert('Starting speech queue'); // Temporary debug alert
        processQueue();
      }, 300);
    } else {
      processQueue();
    }
  }, [selectedVoice, isSafari, isIOS, initializeAudioContext, processQueue]);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      utteranceQueueRef.current = [];
      isProcessingQueueRef.current = false;
      setIsSpeaking(false);
    }
  }, []);

  const pause = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
    }
  }, []);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    voices,
    selectedVoice,
    setSelectedVoice,
    isSafari,
    isIOS,
    initializeAudioContext
  };
}; 