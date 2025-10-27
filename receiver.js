/**
 * Takokase Custom Cast Receiver
 * Supports multi-audio renditions for HLS streams
 */

// Configuration
const CONFIG = {
  DEBUG_MODE: true,
  SPLASH_DURATION: 2000,
  MEDIA_INFO_DURATION: 5000,
  AUDIO_TRACK_INDICATOR_DURATION: 3000,
  LOG_PREFIX: "[Takokase]",
};

// DOM Elements
const elements = {
  splashScreen: document.getElementById("splash-screen"),
  playerContainer: document.getElementById("player-container"),
  mediaInfo: document.getElementById("media-info"),
  mediaTitle: document.getElementById("media-title"),
  mediaSubtitle: document.getElementById("media-subtitle"),
  audioTrackIndicator: document.getElementById("audio-track-indicator"),
  audioTrackText: document.getElementById("audio-track-text"),
  bufferingIndicator: document.getElementById("buffering-indicator"),
  errorMessage: document.getElementById("error-message"),
  errorText: document.getElementById("error-text"),
  debugInfo: document.getElementById("debug-info"),
  debugStatus: document.getElementById("debug-status"),
  debugAudioTracks: document.getElementById("debug-audio-tracks"),
  debugActiveTrack: document.getElementById("debug-active-track"),
  debugPlaybackState: document.getElementById("debug-playback-state"),
};

// Utility: Logging
function log(...args) {
  console.log(CONFIG.LOG_PREFIX, ...args);
}

function logError(...args) {
  console.error(CONFIG.LOG_PREFIX, ...args);
}

// Utility: Show/Hide UI elements
function showElement(element, duration = null) {
  if (!element) return;
  element.classList.add("visible");
  if (duration) {
    setTimeout(() => hideElement(element), duration);
  }
}

function hideElement(element) {
  if (!element) return;
  element.classList.remove("visible");
}

// Utility: Update debug info
function updateDebugInfo(key, value) {
  if (!CONFIG.DEBUG_MODE) return;
  const debugElement =
    elements[`debug${key.charAt(0).toUpperCase() + key.slice(1)}`];
  if (debugElement) {
    debugElement.textContent = value;
  }
}

// Utility: Show error
function showError(message) {
  logError("Error:", message);
  elements.errorText.textContent = message;
  showElement(elements.errorMessage);
  setTimeout(() => hideElement(elements.errorMessage), 5000);
}

// Cast Application Controller
class TakokaseReceiver {
  constructor() {
    this.context = null;
    this.playerManager = null;
    this.currentMediaInfo = null;
    this.availableAudioTracks = [];
    this.activeAudioTrackId = null;

    log("Initializing Takokase Receiver...");
    this.init();
  }

  init() {
    // Get Cast context
    this.context = cast.framework.CastReceiverContext.getInstance();
    this.playerManager = this.context.getPlayerManager();

    // Configure receiver options
    const options = new cast.framework.CastReceiverOptions();

    // Enable detailed logging in debug mode
    if (CONFIG.DEBUG_MODE) {
      options.disableIdleTimeout = false;
      options.maxInactivity = 3600; // 1 hour for debugging
      showElement(elements.debugInfo);
    } else {
      options.maxInactivity = 300; // 5 minutes
    }

    // Set up player manager listeners
    this.setupPlayerListeners();

    // Set up intercept handlers for audio track management
    this.setupInterceptors();

    // Start the receiver
    this.context.start(options);

    log("Receiver started successfully");
    updateDebugInfo("status", "Ready");

    // DON'T hide splash screen here - wait for video to load
    // The splash will be hidden in onLoadComplete()
  }

  setupPlayerListeners() {
    const playerManager = this.playerManager;

    // Player load complete
    playerManager.addEventListener(
      cast.framework.events.EventType.PLAYER_LOAD_COMPLETE,
      (event) => this.onLoadComplete(event)
    );

    // Player loading (when media starts loading)
    playerManager.addEventListener(
      cast.framework.events.EventType.PLAYER_LOADING,
      (event) => {
        log("Player LOADING event - media is being loaded");
        updateDebugInfo("playbackState", "LOADING");
      }
    );

    // Error handling
    playerManager.addEventListener(
      cast.framework.events.EventType.ERROR,
      (event) => this.onError(event)
    );

    log("Player listeners registered");
  }

  setupInterceptors() {
    const playerManager = this.playerManager;

    // Intercept LOAD request to process media info
    playerManager.setMessageInterceptor(
      cast.framework.messages.MessageType.LOAD,
      (loadRequestData) => this.interceptLoad(loadRequestData)
    );

    // Intercept EDIT_TRACKS_INFO to handle audio track changes
    playerManager.setMessageInterceptor(
      cast.framework.messages.MessageType.EDIT_TRACKS_INFO,
      (editTracksInfoRequestData) =>
        this.interceptEditTracks(editTracksInfoRequestData)
    );

    log("Message interceptors registered");
  }

  interceptLoad(loadRequestData) {
    log("🎬 LOAD intercepted:", loadRequestData);

    // Update splash screen to show loading
    elements.splashText.textContent = "Loading Media...";

    const mediaInfo = loadRequestData.media;

    if (mediaInfo) {
      this.currentMediaInfo = mediaInfo;

      log("Media URL:", mediaInfo.contentId);
      log("Content Type:", mediaInfo.contentType);
      log("Stream Type:", mediaInfo.streamType);

      // Log available tracks
      if (mediaInfo.tracks && mediaInfo.tracks.length > 0) {
        log("Available tracks:", mediaInfo.tracks.length);
        mediaInfo.tracks.forEach((track, index) => {
          log(`Track ${index}:`, {
            trackId: track.trackId,
            type: track.type,
            language: track.language,
            name: track.name,
          });
        });
      }

      // Ensure HLS streams have proper configuration
      if (
        mediaInfo.contentType === "application/vnd.apple.mpegurl" ||
        mediaInfo.contentType === "application/x-mpegurl"
      ) {
        log("HLS stream detected - ensuring multi-audio support");

        // Enable adaptive streaming
        if (!mediaInfo.customData) {
          mediaInfo.customData = {};
        }
        mediaInfo.customData.enableAdaptiveStreaming = true;
      }

      // Show media info on screen
      this.displayMediaInfo(mediaInfo);
    } else {
      logError("❌ No media info in load request!");
    }

    return loadRequestData;
  }

  interceptEditTracks(editTracksInfoRequestData) {
    log("EDIT_TRACKS_INFO intercepted:", editTracksInfoRequestData);

    const activeTrackIds = editTracksInfoRequestData.activeTrackIds || [];

    if (activeTrackIds.length > 0) {
      log("Active track IDs requested:", activeTrackIds);

      // Find audio track changes
      const audioTrackId = this.findAudioTrackId(activeTrackIds);
      if (audioTrackId !== null && audioTrackId !== this.activeAudioTrackId) {
        this.activeAudioTrackId = audioTrackId;
        this.showAudioTrackChange(audioTrackId);
      }
    }

    return editTracksInfoRequestData;
  }

  onLoadComplete(event) {
    log("✅ Player LOAD_COMPLETE event - Video ready!");
    updateDebugInfo("playbackState", "LOADED");

    // CRITICAL: Hide splash screen when video is ready to play
    log("Hiding splash screen - video should now be visible");
    hideElement(elements.splashScreen);

    // Detect available audio tracks
    this.detectAudioTracks();

    // Set up status monitoring
    this.setupStatusMonitoring();
  }

  setupStatusMonitoring() {
    // Monitor player status periodically
    setInterval(() => {
      const playerState = this.playerManager.getPlayerState();
      updateDebugInfo("playbackState", playerState);

      // Show/hide buffering indicator
      if (playerState === cast.framework.messages.PlayerState.BUFFERING) {
        showElement(elements.bufferingIndicator);
      } else {
        hideElement(elements.bufferingIndicator);
      }
    }, 1000);
  }

  onError(event) {
    logError("❌ Player error:", event);

    const errorReason =
      event.detailedErrorCode || event.error?.reason || "Unknown error";
    showError(`Playback error: ${errorReason}`);

    // Hide splash on error so user can see error message
    hideElement(elements.splashScreen);
  }

  detectAudioTracks() {
    const mediaElement = this.playerManager.getMediaElement();
    if (!mediaElement) {
      log("No media element available");
      return;
    }

    // For HLS, audio tracks are available via HTMLMediaElement
    const audioTracks = mediaElement.audioTracks;

    if (audioTracks && audioTracks.length > 0) {
      log(`Detected ${audioTracks.length} audio tracks`);

      this.availableAudioTracks = [];

      for (let i = 0; i < audioTracks.length; i++) {
        const track = audioTracks[i];
        const trackInfo = {
          id: track.id,
          label: track.label,
          language: track.language,
          enabled: track.enabled,
          kind: track.kind,
        };

        this.availableAudioTracks.push(trackInfo);
        log(`Audio Track ${i}:`, trackInfo);

        if (track.enabled) {
          this.activeAudioTrackId = i;
          updateDebugInfo("activeTrack", `${track.language} (${track.label})`);
        }
      }

      updateDebugInfo("audioTracks", audioTracks.length);

      // Listen for audio track changes
      audioTracks.addEventListener("change", () => {
        log("Audio track changed by player");
        for (let i = 0; i < audioTracks.length; i++) {
          if (audioTracks[i].enabled) {
            this.activeAudioTrackId = i;
            this.showAudioTrackChange(i);
            break;
          }
        }
      });
    } else {
      log("No audio tracks detected");
      updateDebugInfo("audioTracks", "0");
    }

    // Also check for Cast SDK tracks
    const mediaInfo = this.playerManager.getMediaInformation();
    if (mediaInfo && mediaInfo.tracks) {
      log("Cast SDK tracks:", mediaInfo.tracks);
    }
  }

  findAudioTrackId(activeTrackIds) {
    const mediaInfo = this.playerManager.getMediaInformation();
    if (!mediaInfo || !mediaInfo.tracks) return null;

    for (const trackId of activeTrackIds) {
      const track = mediaInfo.tracks.find((t) => t.trackId === trackId);
      if (track && track.type === "AUDIO") {
        return trackId;
      }
    }
    return null;
  }

  displayMediaInfo(mediaInfo) {
    const metadata = mediaInfo.metadata;

    if (metadata) {
      const title = metadata.title || "Unknown Title";
      const subtitle = metadata.subtitle || "";

      elements.mediaTitle.textContent = title;
      elements.mediaSubtitle.textContent = subtitle;

      showElement(elements.mediaInfo, CONFIG.MEDIA_INFO_DURATION);

      log("Displaying media info:", { title, subtitle });
    }
  }

  showAudioTrackChange(trackId) {
    let trackInfo = "Unknown";

    // Try to get track info from HTMLMediaElement
    const mediaElement = this.playerManager.getMediaElement();
    if (
      mediaElement &&
      mediaElement.audioTracks &&
      trackId < mediaElement.audioTracks.length
    ) {
      const track = mediaElement.audioTracks[trackId];
      trackInfo = track.label || track.language || `Track ${trackId}`;
    } else {
      // Fallback to Cast SDK tracks
      const mediaInfo = this.playerManager.getMediaInformation();
      if (mediaInfo && mediaInfo.tracks) {
        const track = mediaInfo.tracks.find((t) => t.trackId === trackId);
        if (track) {
          trackInfo = track.name || track.language || `Track ${trackId}`;
        }
      }
    }

    log("Audio track changed to:", trackInfo);
    elements.audioTrackText.textContent = `Audio: ${trackInfo}`;
    showElement(
      elements.audioTrackIndicator,
      CONFIG.AUDIO_TRACK_INDICATOR_DURATION
    );
    updateDebugInfo("activeTrack", trackInfo);
  }

  formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs
        .toString()
        .padStart(2, "0")}`;
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }
}

// Initialize the receiver when DOM is ready
window.addEventListener("load", () => {
  new TakokaseReceiver();
});
