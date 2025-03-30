import annyang from "annyang";

export function voiceCommands(onCommandTrigger) {
    if (annyang) {
        const commands = {
        "describe (the scene)": onCommandTrigger,
        };

        annyang.addCommands(commands);
        annyang.start();
    } else {
        console.error("Speech recognition not supported in this browser.");
    }
  }
