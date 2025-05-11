/**
 * Utility for text-to-speech functionality and fallback for iOS using pre-recorded audio.
 */

export function speakText(text, onComplete = null, onError = null, options = {}) {
  if (!('speechSynthesis' in window)) {
    console.warn("Speech synthesis not supported");
    return false;
  }

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  selectVoice(utterance, options);

  utterance.rate = options.rate || 1.0;
  utterance.pitch = options.pitch || 1.0;
  utterance.volume = options.volume || 1.0;

  if (onComplete) {
    utterance.onend = () => onComplete();
  }

  if (onError) {
    utterance.onerror = (event) => onError(event);
  }

  window.speechSynthesis.speak(utterance);
  return true;
}

function selectVoice(utterance, options = {}) {
  const voices = window.speechSynthesis.getVoices();

  if (voices.length === 0) {
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = () => {
        selectVoice(utterance, options);
      };
    }
    utterance.lang = 'en-US';
    return;
  }

  const preferredLang = options.language || 'en';

  let preferredVoice = voices.find(voice =>
    voice.name.toLowerCase().includes('female') &&
    voice.lang.startsWith(preferredLang)
  );

  if (!preferredVoice) {
    preferredVoice = voices.find(voice =>
      ['samantha', 'victoria', 'karen', 'moira', 'tessa'].some(name =>
        voice.name.toLowerCase().includes(name)
      ) && voice.lang.startsWith(preferredLang)
    );
  }

  if (!preferredVoice) {
    preferredVoice = voices.find(voice => voice.lang.startsWith(preferredLang));
  }

  if (preferredVoice) {
    utterance.voice = preferredVoice;
    utterance.lang = preferredVoice.lang;
    console.log(`Using voice: ${preferredVoice.name} (${preferredVoice.lang})`);
  } else {
    utterance.lang = `${preferredLang}-${preferredLang.toUpperCase()}`;
  }
}

/**
 * Speech synthesis can sometimes stop prematurely on longer text in some browsers.
 */
export function speakLongText(text, onComplete = null) {
  const chunks = text.match(/[^\\.!\?]+[\\.!\?]+/g) || [text];
  let currentIndex = 0;

  const speakNextChunk = () => {
    if (currentIndex >= chunks.length) {
      if (onComplete) onComplete();
      return;
    }

    speakText(
      chunks[currentIndex],
      () => {
        currentIndex++;
        speakNextChunk();
      },
      (error) => {
        console.error("Error in chunk speech:", error);
        currentIndex++;
        speakNextChunk();
      }
    );
  };

  speakNextChunk();

  return () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };
}

/**
 * Play a pre-recorded audio file as fallback for iOS
 */
export function playAudio(id) {
  const audio = new Audio(`/audio/${id}.mp3`);
  audio.play().catch(err => console.error("Audio playback failed:", err));
}

/**
 * Smart wrapper that chooses between TTS or audio fallback based on platform
 */
export function smartSpeak(idOrText, fallbackText = null) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isIOS) {
    playAudio(idOrText); // e.g., smartSpeak("welcome")
  } else {
    speakText(fallbackText || idOrText); // fallbackText: spoken sentence
  }
}
