/**
 * Utility for text-to-speech functionality
 * 
 * @param {string} text - The text to speak
 * @param {Function} onComplete - Optional callback function when speech completes
 * @param {Function} onError - Optional callback function when speech errors
 * @param {Object} options - Optional voice settings
 * @returns {boolean} - Whether speech was successfully started
 */
export function speakText(text, onComplete = null, onError = null, options = {}) {
    if (!('speechSynthesis' in window)) {
      console.warn("Speech synthesis not supported");
      return false;
    }
  
    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
  
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Voice selection logic
    selectVoice(utterance, options);
    
    // Apply other options
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
  
  /**
   * Helper function to select the appropriate voice
   */
  function selectVoice(utterance, options = {}) {
    // Ensure voices are loaded
    const voices = window.speechSynthesis.getVoices();
    
    // If no voices are available yet, set up an event listener
    if (voices.length === 0) {
      // Some browsers need an event listener to get voices
      if (speechSynthesis.onvoiceschanged !== undefined) {
        speechSynthesis.onvoiceschanged = () => {
          selectVoice(utterance, options);
        };
      }
      utterance.lang = 'en-US'; // Default language
      return;
    }
    
    // Define language preference (default to English)
    const preferredLang = options.language || 'en';
    
    // Search for female English voices, with priority to ensure we find one
    let preferredVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('female') && 
      voice.lang.startsWith(preferredLang)
    );
    
    // If no explicit female voice found, try other likely female-sounding voices
    if (!preferredVoice) {
      preferredVoice = voices.find(voice => 
        (voice.name.toLowerCase().includes('samantha') || 
         voice.name.toLowerCase().includes('victoria') ||
         voice.name.toLowerCase().includes('karen') ||
         voice.name.toLowerCase().includes('moira') ||
         voice.name.toLowerCase().includes('tessa')) && 
        voice.lang.startsWith(preferredLang)
      );
    }
    
    // Fall back to any voice in the preferred language
    if (!preferredVoice) {
      preferredVoice = voices.find(voice => voice.lang.startsWith(preferredLang));
    }
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      utterance.lang = preferredVoice.lang;
      console.log(`Using voice: ${preferredVoice.name} (${preferredVoice.lang})`);
    } else {
      // If no preferred language voice found, set language anyway
      utterance.lang = `${preferredLang}-${preferredLang.toUpperCase()}`;
    }
  }
  
  /**
   * Speech synthesis can sometimes stop prematurely on longer text in some browsers.
   * This function ensures the speech continues until completion.
   * 
   * @param {string} text - The longer text to speak
   * @param {Function} onComplete - Optional callback when all speech completes
   * @returns {Function} - Cleanup function to cancel speech
   */
  export function speakLongText(text, onComplete = null) {
    // Breaking into sentences or paragraphs may be needed for very long text
    // This is a simple implementation - could be enhanced with sentence detection
    const chunks = text.match(/[^\.!\?]+[\.!\?]+/g) || [text];
    let currentIndex = 0;
    
    const speakNextChunk = () => {
      if (currentIndex >= chunks.length) {
        if (onComplete) onComplete();
        return;
      }
      
      const isLastChunk = currentIndex === chunks.length - 1;
      
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
    
    // Return a cleanup function
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }