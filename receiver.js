const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

// Configure playback settings
const playbackConfig = new cast.framework.PlaybackConfig();

// Enable detailed logging for debugging
context.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);

// Listen for when media is loaded and ready
playerManager.addEventListener(
  cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
  () => {
    console.log("Media loaded successfully");

    // Get the AudioTracksManager
    const audioTracksManager = playerManager.getAudioTracksManager();

    // Get all available audio tracks
    const tracks = audioTracksManager.getTracks();

    console.log("Available audio tracks:", tracks);

    // Log track information for debugging
    tracks.forEach((track, index) => {
      console.log(`Track ${index}:`, {
        id: track.trackId,
        language: track.language,
        name: track.name,
      });
    });

    // Optional: Set default audio track (e.g., first track)
    if (tracks.length > 0) {
      const activeTrack = audioTracksManager.getActiveTrack();
      console.log("Active track:", activeTrack);
    }
  }
);

// Handle audio track switching requests from sender
playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.EDIT_AUDIO_TRACKS,
  (request) => {
    console.log("Audio track switch requested:", request);

    // You can add custom logic here if needed
    // For example, language code conversion

    return request; // Return the request to proceed with the switch
  }
);

// Optional: Handle track info editing (for language code conversion)
playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.EDIT_TRACKS_INFO,
  (request) => {
    console.log("Edit tracks info:", request);

    // Example: Convert language codes if needed
    // if (request.language === 'jp') {
    //     request.language = 'ja';
    // }

    return request;
  }
);

// Configure supported media types
const options = new cast.framework.CastReceiverOptions();
options.maxInactivity = 3600; // 1 hour timeout

// Start the receiver application
context.start(options);

console.log("Custom receiver started");
