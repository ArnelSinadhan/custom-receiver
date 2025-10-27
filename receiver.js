const context = cast.framework.CastReceiverContext.getInstance();
const playerManager = context.getPlayerManager();

context.setLoggerLevel(cast.framework.LoggerLevel.DEBUG);

playerManager.addEventListener(
  cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
  () => {
    console.log("Media loaded");
    const audioTracksManager = playerManager.getAudioTracksManager();
    const tracks = audioTracksManager.getTracks();
    console.log("Audio tracks:", tracks.length);
  }
);

playerManager.setMessageInterceptor(
  cast.framework.messages.MessageType.EDIT_AUDIO_TRACKS,
  (request) => {
    console.log("Switching audio track");
    return request;
  }
);

context.start();
