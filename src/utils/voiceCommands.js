export async function voiceCommands( {describeScene} ) {
    const isSpeechRecognitionSupported = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;

    if (!isSpeechRecognitionSupported) {
        alert("Speech recognition not supported in this browser.");
    }

    // Only import annyang if supported
    const annyang = (await import("annyang")).default;

    if (annyang) {
        const commands = {
            "describe (the scene)": describeScene,
            "describe": describeScene,
            "what's happening": describeScene,
            "show me my blind spot": describeScene,
            "jarvis (clip that)": describeScene
        };

        annyang.addCommands(commands);
        annyang.start();
    }
  }
