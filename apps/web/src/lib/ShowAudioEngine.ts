import { dmxEngine } from './dmxEngine';
import useStore from '../store/useStore';

class ShowAudioEngine {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private audioSource: MediaElementAudioSourceNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  
  // Waveform extraction cache
  private waveformDataCache = new Map<string, number[]>();

  // Analysis state
  private freqData: Uint8Array = new Uint8Array(0);
  private animationId: number | null = null;
  private bassHistory: number[] = [];
  private lastBeatTime: number = 0;
  private beatThreshold = 1.35;
  private beatIntervals: number[] = [];

  // Active state
  private onFrequencyDataCallback: ((freqs: number[]) => void) | null = null;
  private onBeatCallback: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';

      // HTML5 elements audio volume binding
      this.audioEl.addEventListener('play', () => {
        this.resumeContext();
        this.startLoop();
      });

      this.audioEl.addEventListener('pause', () => {
        this.stopLoop();
      });

      this.audioEl.addEventListener('ended', () => {
        this.stopLoop();
        this.handleTrackEnded();
      });
    }
  }

  getAudioElement(): HTMLAudioElement | null {
    return this.audioEl;
  }

  private initContext() {
    if (this.audioContext) return;
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 512;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    if (this.audioEl) {
      this.audioSource = this.audioContext.createMediaElementSource(this.audioEl);
      this.audioSource.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    }
  }

  private resumeContext() {
    this.initContext();
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  // Set local file or stream url
  setTrack(url: string) {
    if (!this.audioEl) return;
    this.audioEl.src = url;
    this.audioEl.load();
    this.resumeContext();
  }

  play() {
    if (!this.audioEl) return;
    this.resumeContext();
    this.audioEl.play().catch(e => console.warn('[ShowAudioEngine] Play failed', e));
  }

  pause() {
    if (!this.audioEl) return;
    this.audioEl.pause();
  }

  setVolume(vol: number) {
    if (!this.audioEl) return;
    this.audioEl.volume = Math.max(0, Math.min(1, vol));
  }

  getCurrentTime(): number {
    return this.audioEl ? this.audioEl.currentTime : 0;
  }

  setCurrentTime(seconds: number) {
    if (this.audioEl) {
      this.audioEl.currentTime = seconds;
    }
  }

  setOnFrequencyData(cb: (freqs: number[]) => void) {
    this.onFrequencyDataCallback = cb;
  }

  setOnBeat(cb: () => void) {
    this.onBeatCallback = cb;
  }

  // Switch between internal player and microphone/loopback
  async setSource(sourceType: 'player' | 'mic') {
    this.resumeContext();
    if (!this.audioContext || !this.analyser) return;

    if (sourceType === 'mic') {
      // Disconnect elements source output from destination to prevent feedback loop, but keep analyser
      try {
        if (this.audioSource) {
          this.audioSource.disconnect();
          this.audioSource.connect(this.analyser);
        }

        // Get microphone stream
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.micSource = this.audioContext.createMediaStreamSource(this.stream);
        this.micSource.connect(this.analyser);
        this.startLoop();
      } catch (e) {
        console.error('[ShowAudioEngine] Microphone access error', e);
        useStore.getState().addToast({
          type: 'error',
          message: 'Erreur Microphone',
          detail: 'Impossible d\'accéder à l\'entrée microphone.'
        });
        useStore.getState().setAudioSource('player');
        this.setSource('player');
      }
    } else {
      // Re-connect elements source to destination
      if (this.micSource) {
        this.micSource.disconnect();
        this.micSource = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
      }

      if (this.audioSource && this.analyser) {
        this.audioSource.disconnect();
        this.audioSource.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
      }
      
      if (this.audioEl && this.audioEl.paused) {
        this.stopLoop();
      }
    }
  }

  // Loop execution for analysis & DMX routing
  private startLoop() {
    if (this.animationId !== null) return;
    const loop = () => {
      this.analyze();
      this.animationId = requestAnimationFrame(loop);
    };
    this.animationId = requestAnimationFrame(loop);
  }

  private stopLoop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // Analyze frequencies, compute BPM & dispatch DMX values
  private analyze() {
    if (!this.analyser || !this.freqData.length) return;
    this.analyser.getByteFrequencyData(this.freqData as Uint8Array<ArrayBuffer>);

    const length = this.freqData.length;
    
    // Frequency decomposition
    // Bass (0-150Hz): index 0 to ~16
    let bassSum = 0;
    const bassCount = 16;
    for (let i = 0; i < bassCount; i++) bassSum += this.freqData[i];
    const bass = bassSum / bassCount;

    // Mids (150-2000Hz): index 16 to ~110
    let midSum = 0;
    const midCount = 94;
    for (let i = 16; i < 110; i++) midSum += this.freqData[i];
    const mid = midSum / midCount;

    // Highs (2000-20000Hz): index 110 to ~256
    let highSum = 0;
    const highCount = length - 110;
    for (let i = 110; i < length; i++) highSum += this.freqData[i];
    const high = highSum / highCount;

    // Normalize values to 0-255 range
    const bassNorm = Math.min(255, Math.max(0, bass * 1.5));
    const midNorm = Math.min(255, Math.max(0, mid * 1.6));
    const highNorm = Math.min(255, Math.max(0, high * 1.8));

    if (this.onFrequencyDataCallback) {
      this.onFrequencyDataCallback([bassNorm, midNorm, highNorm]);
    }

    // BPM Beat Detection on Bass
    this.bassHistory.push(bass);
    if (this.bassHistory.length > 44) this.bassHistory.shift(); // ~1 second moving window

    const bassAvg = this.bassHistory.reduce((a, b) => a + b, 0) / this.bassHistory.length;
    const now = Date.now();

    if (bass > 30 && bass > bassAvg * this.beatThreshold && now - this.lastBeatTime > 280) {
      this.lastBeatTime = now;
      this.handleBeat();
    }

    // DMX Dispatch mapping
    this.dispatchDmxAuto(bassNorm, midNorm, highNorm);
  }

  private handleBeat() {
    if (this.onBeatCallback) this.onBeatCallback();
    
    // BPM Calculation from beats
    const now = Date.now();
    if (this.lastBeatTime > 0) {
      const diff = now - this.lastBeatTime;
      if (diff > 280 && diff < 1500) {
        this.beatIntervals.push(diff);
        if (this.beatIntervals.length > 8) this.beatIntervals.shift();
        
        const avgInterval = this.beatIntervals.reduce((a, b) => a + b, 0) / this.beatIntervals.length;
        const calculatedBpm = Math.round(60000 / avgInterval);
        
        // Update BPM in store
        useStore.getState().setBpm(calculatedBpm);
      }
    }
  }

  // Routes audio analysis into the 6 DMX fixture groups Face, Douche 1-3, Latéral, Contre
  private dispatchDmxAuto(bass: number, mid: number, high: number) {
    const state = useStore.getState();
    const playlist = state.playlist;
    const activeIdx = state.currentTrackIndex;
    const track = playlist[activeIdx];

    // Mute helper
    const mutes = state.groupMutes;
    const levels = state.groupLevels;
    const colors = state.groupColors;
    const masterLevel = state.masterVolume; // 0 to 1

    // Skip automation if mode is Manuel or if blackout is active
    if (state.smartBlackout) {
      // Set master out blackout
      return;
    }

    const currentMode = track ? track.lightMode : 'manuel';
    if (currentMode === 'manuel') {
      // In manual mode, we do not automate the channels via Web Audio.
      return;
    }

    // We only automate if Mode is IA Lumière (or Programme but with live modifiers)
    if (currentMode !== 'ia') return;

    const preset = track ? track.aiPreset : 'rock';
    const fixtures = state.fixtures; // Patched fixtures from API

    if (fixtures.length === 0) return;

    // Intelligent mapping algorithms
    let faceDim = mid * 0.7;
    let dch1Dim = mid * 0.9;
    let dch2Dim = bass > 150 ? 255 : bass * 0.8; // flashes on kick
    let dch3Dim = high * 1.0; // flashes on high cymbals
    let latDim = (bass * 0.3 + mid * 0.5) * 0.8;
    let contreDim = (bass * 0.5 + high * 0.5);

    // Apply algorithm presets
    if (preset === 'jazz') {
      faceDim = Math.min(180, mid * 0.6);
      dch1Dim = Math.min(160, mid * 0.7);
      dch2Dim = Math.min(120, bass * 0.5); // very soft
      dch3Dim = Math.min(100, high * 0.4);
      latDim = Math.min(100, mid * 0.5);
      contreDim = Math.min(120, mid * 0.5);
    } else if (preset === 'tv') {
      faceDim = 200; // stable face lighting
      dch1Dim = 150;
      dch2Dim = 120;
      dch3Dim = 100;
      latDim = 100;
      contreDim = 120;
    } else if (preset === 'club') {
      // More extreme accents
      dch2Dim = bass > 120 ? 255 : 0; // strobe-like on beats
      dch3Dim = high > 140 ? 255 : 0;
    }

    const time = Date.now();

    // Iterate through fixtures and set DMX channels
    fixtures.forEach((f: any) => {
      const fixtureId = f.id;
      const start = f.start_address || f.startAddress || 1;
      const universe = f.universe || 1;
      const channels = f.channels || [];

      // Determine which group this fixture belongs to.
      // We can map them based on either a custom user mapping, or automatically by indexing:
      // Default auto mapping based on ID:
      // Even division into the 6 groups
      let groupName = 'Face';
      if (fixtureId % 6 === 0) groupName = 'Face';
      else if (fixtureId % 6 === 1) groupName = 'Douche 1';
      else if (fixtureId % 6 === 2) groupName = 'Douche 2';
      else if (fixtureId % 6 === 3) groupName = 'Douche 3';
      else if (fixtureId % 6 === 4) groupName = 'Latéral';
      else groupName = 'Contre';

      // Check if user has explicit mappings
      Object.entries(state.smartZoneMappings || {}).forEach(([zoneKey, mapping]: any) => {
        if (mapping.fixtures && mapping.fixtures.includes(fixtureId)) {
          // Map Stage/Bar/Dancefloor/Master to groups Face/Douche1-3/Lat/Contre
          if (zoneKey === 'Stage') groupName = 'Douche 1';
          if (zoneKey === 'Bar') groupName = 'Latéral';
          if (zoneKey === 'Dancefloor') groupName = 'Douche 2';
        }
      });

      // Mute state
      const isMuted = mutes[groupName] === true;
      const groupLevelMultiplier = (levels[groupName] ?? 80) / 100 * masterLevel;

      // Group colors
      const hexColor = colors[groupName] || '#ffffff';
      const rVal = parseInt(hexColor.slice(1, 3), 16);
      const gVal = parseInt(hexColor.slice(3, 5), 16);
      const bVal = parseInt(hexColor.slice(5, 7), 16);

      // Determine dimmer value for this group
      let groupDim = 255;
      if (groupName === 'Face') groupDim = faceDim;
      else if (groupName === 'Douche 1') groupDim = dch1Dim;
      else if (groupName === 'Douche 2') groupDim = dch2Dim;
      else if (groupName === 'Douche 3') groupDim = dch3Dim;
      else if (groupName === 'Latéral') groupDim = latDim;
      else if (groupName === 'Contre') groupDim = contreDim;

      const finalDimmerValue = isMuted ? 0 : Math.round(groupDim * groupLevelMultiplier);

      // Loop through channels of this fixture
      channels.forEach((ch: any) => {
        const absCh = start + ch.channel - 1;
        const type = ch.type;

        if (type === 'dimmer' || type === 'intensity') {
          dmxEngine.setChannel(universe, absCh, finalDimmerValue);
        } else if (type === 'red') {
          dmxEngine.setChannel(universe, absCh, isMuted ? 0 : Math.round(rVal * (finalDimmerValue / 255)));
        } else if (type === 'green') {
          dmxEngine.setChannel(universe, absCh, isMuted ? 0 : Math.round(gVal * (finalDimmerValue / 255)));
        } else if (type === 'blue') {
          dmxEngine.setChannel(universe, absCh, isMuted ? 0 : Math.round(bVal * (finalDimmerValue / 255)));
        } else if (type === 'white') {
          dmxEngine.setChannel(universe, absCh, isMuted ? 0 : Math.round(finalDimmerValue * 0.8));
        } else if (type === 'pan') {
          // LFO sweep based on group and energy
          let speed = 0.001;
          if (groupName === 'Latéral') speed = 0.002 * (bass / 128 + 0.5);
          if (groupName === 'Contre') speed = 0.0015;
          const range = 60; // degrees
          const center = 127;
          const panVal = Math.round(center + Math.sin(time * speed + fixtureId) * range);
          dmxEngine.setChannel(universe, absCh, panVal);
        } else if (type === 'tilt') {
          let speed = 0.001;
          if (groupName === 'Latéral') speed = 0.001 * (mid / 128 + 0.5);
          const range = 40;
          const center = 127;
          const tiltVal = Math.round(center + Math.cos(time * speed + fixtureId) * range);
          dmxEngine.setChannel(universe, absCh, tiltVal);
        } else if (type === 'strobe' || type === 'shutter') {
          // Flash stroboscope if energy is extremely high
          if (preset === 'club' && bass > 220) {
            dmxEngine.setChannel(universe, absCh, 240); // Fast strobe DMX value
          } else {
            dmxEngine.setChannel(universe, absCh, 0); // Open/Normal
          }
        }
      });
    });

    // Capture recording live state (Rec Lumière)
    if (state.isRecording) {
      this.recordFrameToTimeline(faceDim, dch1Dim, dch2Dim, dch3Dim, latDim, contreDim);
    }
  }

  // Record a frame to the current active track's timeline clips list
  private recordFrameToTimeline(face: number, dch1: number, dch2: number, dch3: number, lat: number, contre: number) {
    const state = useStore.getState();
    if (!this.audioEl || !state.isRecording || state.recordingStartTime === null) return;
    
    // Elapsed playback time in milliseconds
    const elapsedMs = Math.round(this.audioEl.currentTime * 1000);
    const durationMs = 100; // Each capture slice is 100ms
    
    // Add timeline clips for active groups in real-time
    const groups = [
      { name: 'Face', val: face, track: 'lights', color: 'bg-cyan-500' },
      { name: 'Douche 1', val: dch1, track: 'lights', color: 'bg-blue-500' },
      { name: 'Douche 2', val: dch2, track: 'lights', color: 'bg-green-500' },
      { name: 'Douche 3', val: dch3, track: 'lights', color: 'bg-red-500' },
      { name: 'Latéral', val: lat, track: 'fx', color: 'bg-purple-500' },
      { name: 'Contre', val: contre, track: 'visuals', color: 'bg-pink-500' },
    ];

    groups.forEach(g => {
      // Record if group is producing active output
      if (g.val > 50) {
        const clipId = `rec-${g.name}-${elapsedMs}`;
        const clip = {
          id: clipId,
          track: g.track as any,
          name: `${g.name} (${Math.round((g.val/255)*100)}%)`,
          startTime: elapsedMs,
          duration: durationMs,
          color: g.color,
          textColor: 'text-white',
        };
        // Add to timeline
        state.addClip(clip);
      }
    });
  }

  private handleTrackEnded() {
    const state = useStore.getState();
    const current = state.currentTrackIndex;
    const playlist = state.playlist;
    
    if (current < playlist.length - 1) {
      // Go to next track
      state.setCurrentTrackIndex(current + 1);
      
      // Check if next item is a pause card
      const nextTrack = playlist[current + 1];
      if (nextTrack && nextTrack.isPause) {
        // Handle timed pause or manual stop
        state.setIsPlaying(false);
        if (nextTrack.pauseDuration > 0) {
          // Start timed pause countdown
          setTimeout(() => {
            if (state.currentTrackIndex === current + 1) {
              state.setCurrentTrackIndex(current + 2);
              this.autoPlayNext();
            }
          }, nextTrack.pauseDuration * 1000);
        }
      } else {
        this.autoPlayNext();
      }
    } else {
      state.setIsPlaying(false);
    }
  }

  private autoPlayNext() {
    const state = useStore.getState();
    const playlist = state.playlist;
    const active = playlist[state.currentTrackIndex];
    if (active && active.fileUrl) {
      this.setTrack(active.fileUrl);
      this.play();
      state.setIsPlaying(true);
    }
  }

  // Visual Waveform Amplitude Analyzer
  async getWaveformData(url: string, points = 100): Promise<number[]> {
    if (this.waveformDataCache.has(url)) {
      return this.waveformDataCache.get(url)!;
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.clone().arrayBuffer();
      
      const offlineCtx = new OfflineAudioContext(1, arrayBuffer.byteLength, 44100);
      const buffer = await offlineCtx.decodeAudioData(arrayBuffer);
      const rawData = buffer.getChannelData(0);
      const blockSize = Math.floor(rawData.length / points);
      
      const filteredData: number[] = [];
      for (let i = 0; i < points; i++) {
        const blockStart = blockSize * i;
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[blockStart + j]);
        }
        filteredData.push(sum / blockSize);
      }
      
      // Normalize values to 0 - 1 range
      const max = Math.max(...filteredData) || 1;
      const normalized = filteredData.map(v => v / max);
      this.waveformDataCache.set(url, normalized);
      return normalized;
    } catch {
      // Fallback: Return a fake wave pattern if decode fails or it's a video file URL
      const fallback: number[] = [];
      for (let i = 0; i < points; i++) {
        fallback.push(Math.abs(Math.sin(i * 0.1) * 0.5 + Math.cos(i * 0.25) * 0.3 + Math.random() * 0.2));
      }
      return fallback;
    }
  }
}

export const showAudioEngine = new ShowAudioEngine();
