import { useState, useCallback, useEffect } from 'react';
import { speakText, speakLongText } from './textToSpeech';

export const useSpeech = () => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [hasUserInteracted, setHasUserInteracted] = useState(false);

  // Detect Safari and iOS
  useEffect(() => {
    const isSafariBrowser = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                       (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsSafari(isSafariBrowser);
    setIsIOS(isIOSDevice);
  }, []);

  const speak = useCallback(async (text, options = {}) => {
    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      return;
    }

    // For iOS, ensure we have user interaction
    if (isIOS && !hasUserInteracted) {
      console.warn('Speech synthesis requires user interaction on iOS');
      return;
    }

    setIsSpeaking(true);

    // Use speakLongText for better handling of longer text
    const cleanup = speakLongText(text, () => {
      setIsSpeaking(false);
    });

    // Return cleanup function
    return cleanup;
  }, [isIOS, hasUserInteracted]);

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

  const initializeAudioContext = useCallback(async () => {
    if (isIOS || isSafari) {
      setHasUserInteracted(true);
    }
  }, [isIOS, isSafari]);

  return {
    speak,
    stop,
    pause,
    resume,
    isSpeaking,
    isSafari,
    isIOS,
    initializeAudioContext
  };
}; 