import { useState, useCallback, useEffect } from 'react';

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isSafari, setIsSafari] = useState(false);
  const [audioContext, setAudioContext] = useState(null);

  // Detect Safari
  useEffect(() => {
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    setIsSafari(isSafariBrowser);
  }, []);

  // Initialize audio context for Safari
  useEffect(() => {
    if (isSafari && !audioContext) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const context = new AudioContext();
      setAudioContext(context);
    }
  }, [isSafari, audioContext]);

  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      setVoices(availableVoices);
      
      // Try to find a female English voice by default
      const preferredVoice = availableVoices.find(
        voice => voice.lang.startsWith('en') && voice.name.toLowerCase().includes('female')
      ) || availableVoices[0];
      
      setSelectedVoice(preferredVoice);
    };

    // Handle voice loading differently for Safari
    if (isSafari) {
      // Safari needs a small delay to load voices
      setTimeout(loadVoices, 100);
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

  const speak = useCallback((text, options = {}) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

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
      utterance.rate = options.rate || 1.0;
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

      // Safari mobile needs special handling
      if (isSafari) {
        // Resume audio context if it's suspended
        if (audioContext && audioContext.state === 'suspended') {
          audioContext.resume();
        }
        
        // Add a small delay for Safari
        setTimeout(() => {
          window.speechSynthesis.speak(utterance);
        }, 100);
      } else {
        window.speechSynthesis.speak(utterance);
      }
    };

    speakNextChunk();
  }, [selectedVoice, isSafari, audioContext]);

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