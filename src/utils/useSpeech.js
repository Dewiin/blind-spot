import { useState, useCallback, useEffect, useRef } from 'react';

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSafari, setIsSafari] = useState(false);
  const audioContextRef = useRef(null);
  const voicesLoadedRef = useRef(false);
  const hasUserInteractedRef = useRef(false);
  const utteranceQueueRef = useRef([]);
  const isProcessingQueueRef = useRef(false);

  // Detect Safari
  useEffect(() => {
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);
  }, []);

  // Initialize audio context for Safari
  useEffect(() => {
    if (isSafari && !audioContextRef.current) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      audioContextRef.current = new AudioContext();
    }
  }, [isSafari]);

  // Load available voices with improved Safari handling
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

    // Handle voice loading differently for Safari
    if (isSafari) {
      // Safari needs multiple attempts to load voices
      let attempts = 0;
      const maxAttempts = 10;
      
      const attemptLoadVoices = () => {
        loadVoices();
        if (!voicesLoadedRef.current && attempts < maxAttempts) {
          attempts++;
          setTimeout(attemptLoadVoices, 200);
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
  }, [isSafari]);

  // Process utterance queue
  const processQueue = useCallback(() => {
    if (isProcessingQueueRef.current || utteranceQueueRef.current.length === 0) {
      return;
    }

    isProcessingQueueRef.current = true;
    const utterance = utteranceQueueRef.current[0];

    utterance.onend = () => {
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

    window.speechSynthesis.speak(utterance);
  }, []);

  // Initialize audio context on user interaction
  const initializeAudioContext = useCallback(async () => {
    if (isSafari && audioContextRef.current && audioContextRef.current.state === 'suspended') {
      try {
        await audioContextRef.current.resume();
        hasUserInteractedRef.current = true;
      } catch (e) {
        console.error('Failed to resume audio context:', e);
      }
    }
  }, [isSafari]);

  const speak = useCallback(async (text, options = {}) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    utteranceQueueRef.current = [];
    isProcessingQueueRef.current = false;

    // For Safari, ensure audio context is running
    if (isSafari) {
      await initializeAudioContext();
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
      utterance.rate = options.rate || 1.15;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      utteranceQueueRef.current.push(utterance);
    });

    setIsSpeaking(true);

    // Start processing the queue
    if (isSafari) {
      // Add a small delay for Safari
      setTimeout(() => {
        processQueue();
      }, 100);
    } else {
      processQueue();
    }
  }, [selectedVoice, isSafari, initializeAudioContext, processQueue]);

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
    initializeAudioContext
  };
}; 