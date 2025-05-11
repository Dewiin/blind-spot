// import { useState, useCallback, useEffect, useRef } from 'react';

// export const useSpeech = () => {
//   const [isSpeaking, setIsSpeaking] = useState(false);
//   const [voices, setVoices] = useState([]);
//   const [selectedVoice, setSelectedVoice] = useState(null);
//   const [isSafari, setIsSafari] = useState(false);
//   const [isIOS, setIsIOS] = useState(false);
//   const audioContextRef = useRef(null);
//   const voicesLoadedRef = useRef(false);
//   const hasUserInteractedRef = useRef(false);
//   const utteranceQueueRef = useRef([]);
//   const isProcessingQueueRef = useRef(false);

//   // Detect Safari and iOS
//   useEffect(() => {
//     const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
//     const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
//                        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
//     setIsSafari(isSafariBrowser);
//     setIsIOS(isIOSDevice);
//   }, []);

//   // Initialize audio context for Safari/iOS
//   useEffect(() => {
//     if ((isSafari || isIOS) && !audioContextRef.current) {
//       const AudioContext = window.AudioContext || window.webkitAudioContext;
//       audioContextRef.current = new AudioContext();
//     }
//   }, [isSafari, isIOS]);

//   // Load available voices with improved Safari/iOS handling
//   useEffect(() => {
//     const loadVoices = () => {
//       const availableVoices = window.speechSynthesis.getVoices();
//       if (availableVoices.length > 0) {
//         setVoices(availableVoices);
//         voicesLoadedRef.current = true;
        
//         // Try to find a female English voice by default
//         const preferredVoice = availableVoices.find(
//           voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
//         ) || availableVoices[0];
        
//         setSelectedVoice(preferredVoice);
//       }
//     };

//     // Handle voice loading differently for Safari/iOS
//     if (isSafari || isIOS) {
//       // Safari/iOS needs multiple attempts to load voices
//       let attempts = 0;
//       const maxAttempts = 10;
      
//       const attemptLoadVoices = () => {
//         loadVoices();
//         if (!voicesLoadedRef.current && attempts < maxAttempts) {
//           attempts++;
//           setTimeout(attemptLoadVoices, 200);
//         }
//       };
      
//       // Initial attempt
//       attemptLoadVoices();
      
//       // Also listen for voiceschanged event
//       window.speechSynthesis.onvoiceschanged = loadVoices;
//     } else {
//       if (window.speechSynthesis.onvoiceschanged !== undefined) {
//         window.speechSynthesis.onvoiceschanged = loadVoices;
//       }
//       loadVoices();
//     }
//   }, [isSafari, isIOS]);

//   // Process utterance queue
//   const processQueue = useCallback(() => {
//     if (isProcessingQueueRef.current || utteranceQueueRef.current.length === 0) {
//       return;
//     }

//     isProcessingQueueRef.current = true;
//     const utterance = utteranceQueueRef.current[0];

//     utterance.onend = () => {
//       utteranceQueueRef.current.shift();
//       isProcessingQueueRef.current = false;
//       if (utteranceQueueRef.current.length > 0) {
//         processQueue();
//       } else {
//         setIsSpeaking(false);
//       }
//     };

//     utterance.onerror = (event) => {
//       console.error('Speech synthesis error:', event);
//       utteranceQueueRef.current.shift();
//       isProcessingQueueRef.current = false;
//       if (utteranceQueueRef.current.length > 0) {
//         processQueue();
//       } else {
//         setIsSpeaking(false);
//       }
//     };

//     // For iOS, we need to ensure the audio context is running
//     if (isIOS && audioContextRef.current && audioContextRef.current.state === 'suspended') {
//       audioContextRef.current.resume().then(() => {
//         window.speechSynthesis.speak(utterance);
//       }).catch(console.error);
//     } else {
//       window.speechSynthesis.speak(utterance);
//     }
//   }, [isIOS]);

//   // Initialize audio context on user interaction
//   const initializeAudioContext = useCallback(async () => {
//     if ((isSafari || isIOS) && audioContextRef.current && audioContextRef.current.state === 'suspended') {
//       try {
//         await audioContextRef.current.resume();
//         hasUserInteractedRef.current = true;
//       } catch (e) {
//         console.error('Failed to resume audio context:', e);
//       }
//     }
//   }, [isSafari, isIOS]);

//   const speak = useCallback(async (text, options = {}) => {
//     if (!window.speechSynthesis) {
//       console.warn('Speech synthesis not supported');
//       return;
//     }

//     // For iOS, ensure we have user interaction
//     if (isIOS && !hasUserInteractedRef.current) {
//       console.warn('Speech synthesis requires user interaction on iOS');
//       return;
//     }

//     // Cancel any ongoing speech
//     window.speechSynthesis.cancel();
//     utteranceQueueRef.current = [];
//     isProcessingQueueRef.current = false;

//     // For Safari/iOS, ensure audio context is running
//     if (isSafari || isIOS) {
//       await initializeAudioContext();
//     }

//     // Split text into chunks for better handling
//     const chunks = text.match(/[^.!?]+[.!?]+/g) || [text];

//     // Create utterances for each chunk
//     chunks.forEach(chunk => {
//       const utterance = new SpeechSynthesisUtterance(chunk);
      
//       // Apply voice settings
//       if (selectedVoice) {
//         utterance.voice = selectedVoice;
//       }
//       utterance.rate = options.rate || 1.10;
//       utterance.pitch = options.pitch || 1.0;
//       utterance.volume = options.volume || 1.0;

//       utteranceQueueRef.current.push(utterance);
//     });

//     setIsSpeaking(true);

//     // Start processing the queue
//     if (isSafari || isIOS) {
//       // Add a small delay for Safari/iOS
//       setTimeout(() => {
//         processQueue();
//       }, 100);
//     } else {
//       processQueue();
//     }
//   }, [selectedVoice, isSafari, isIOS, initializeAudioContext, processQueue]);

//   const stop = useCallback(() => {
//     if (window.speechSynthesis) {
//       window.speechSynthesis.cancel();
//       utteranceQueueRef.current = [];
//       isProcessingQueueRef.current = false;
//       setIsSpeaking(false);
//     }
//   }, []);

//   const pause = useCallback(() => {
//     if (window.speechSynthesis) {
//       window.speechSynthesis.pause();
//       setIsSpeaking(false);
//     }
//   }, []);

//   const resume = useCallback(() => {
//     if (window.speechSynthesis) {
//       window.speechSynthesis.resume();
//       setIsSpeaking(true);
//     }
//   }, []);

//   return {
//     speak,
//     stop,
//     pause,
//     resume,
//     isSpeaking,
//     voices,
//     selectedVoice,
//     setSelectedVoice,
//     isSafari,
//     isIOS,
//     initializeAudioContext
//   };
// }; 




// testing
import { useState, useEffect, useRef, useCallback } from 'react';

export const useSpeech = () => {
  const [speaking, setSpeaking] = useState(false);
  const speechRef = useRef(null);
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const audioContextRef = useRef(null);
  const [audioContextInitialized, setAudioContextInitialized] = useState(false);

  const initializeAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    setAudioContextInitialized(true);
  }, []);

  const speak = useCallback((text) => {
    if (!text || speaking) {
      return;
    }

    if ((isSafari || isIOS) && !audioContextInitialized) {
      console.warn("Audio context not initialized on iOS. Call initializeAudioContext after user interaction.");
      return;
    }

    setSpeaking(true);
    speechRef.current = new SpeechSynthesisUtterance();
    speechRef.current.text = text;
    speechRef.current.lang = 'en-US'; // You can make this configurable
    speechRef.current.onend = () => {
      setSpeaking(false);
    };
    speechRef.current.onerror = (event) => {
      console.error("Speech synthesis error:", event);
      setSpeaking(false);
    };

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.speak(speechRef.current);
    } else {
      console.error("Speech synthesis not supported in this browser.");
      setSpeaking(false);
    }
  }, [speaking, isSafari, isIOS, audioContextInitialized]);

  const cancel = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis && speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  }, [speaking]);

  useEffect(() => {
    return () => {
      if (speechRef.current) {
        speechRef.current.onend = null;
        speechRef.current.onerror = null;
      }
      cancel();
    };
  }, [cancel]);

  return { speak, speaking, cancel, isSafari, isIOS, initializeAudioContext };
};