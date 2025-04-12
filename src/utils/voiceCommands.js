import annyang from "annyang";

export function voiceCommands( {describeScene} ) {
    if (annyang) {
        const commands = {
            "describe (the scene)": describeScene,
        };

        annyang.addCommands(commands);
        annyang.start();
    } else {
        console.error("Speech recognition not supported in this browser.");
    }
  }
