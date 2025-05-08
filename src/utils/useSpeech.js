import { useState, useCallback, useEffect, useRef } from 'react';

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSafari, setIsSafari] = useState(false);
  const audioContextRef = useRef(null);
  const voicesLoadedRef = useRef(false);

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

  // Load available voices
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
      const attemptLoadVoices = () => {
        loadVoices();
        if (!voicesLoadedRef.current) {
          setTimeout(attemptLoadVoices, 100);
        }
      };
      attemptLoadVoices();
    } else {
      // Other browsers can use the event
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      loadVoices();
    }
  }, [isSafari]);

  // Split text into manageable chunks
  const splitTextIntoChunks = (text) => {
    // Split by sentences, keeping the punctuation
    return text.match(/[^.!?]+[.!?]+/g) || [text];
  };

  const speak = useCallback(async (text, options = {}) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    // For Safari, ensure audio context is running
    if (isSafari && audioContextRef.current) {
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
    }

    // Split text into chunks for better handling
    const chunks = splitTextIntoChunks(text);
    let currentChunkIndex = 0;

    const speakNextChunk = () => {
      if (currentChunkIndex >= chunks.length) {
        setIsSpeaking(false);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[currentChunkIndex]);
      
      // Apply voice settings
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = options.rate || 1.175;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      // Handle speech events
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => {
        currentChunkIndex++;
        speakNextChunk();
      };
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        setIsSpeaking(false);
      };

      // Safari needs special handling
      if (isSafari) {
        // Ensure we have voices loaded and audio context is running
        if (!voicesLoadedRef.current) {
          setTimeout(() => {
            window.speechSynthesis.speak(utterance);
          }, 100);
        } else {
          // Add a small delay for Safari to ensure audio context is ready
          setTimeout(() => {
            window.speechSynthesis.speak(utterance);
          }, 50);
        }
      } else {
        window.speechSynthesis.speak(utterance);
      }
    };

    speakNextChunk();
  }, [selectedVoice, isSafari]);

  const stop = useCallback(() => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
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
    isSafari
  };
}; 