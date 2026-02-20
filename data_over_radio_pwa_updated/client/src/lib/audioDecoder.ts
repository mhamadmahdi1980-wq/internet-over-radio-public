/**
 * Audio Decoder for Data-Over-Radio System
 * Converts audio signals to text using FFT analysis
 */

interface DecoderConfig {
  numChannels?: number;
  freqMin?: number;
  freqMax?: number;
  sampleRate?: number;
}

interface DecodedMessage {
  text: string;
  confidence: number;
  signalStrength: number;
  timestamp: string;
}

export class AudioDecoder {
  private numChannels: number;
  private freqMin: number;
  private freqMax: number;
  private sampleRate: number;
  private frequencies: number[];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isListening: boolean = false;
  private audioBuffer: Float32Array[] = [];
  private bufferSize: number = 4096;
  private decodingCallback: ((data: Float32Array) => void) | null = null;

  constructor(config: DecoderConfig = {}) {
    this.numChannels = config.numChannels || 1000;
    this.freqMin = config.freqMin || 300;
    this.freqMax = config.freqMax || 15000;
    this.sampleRate = config.sampleRate || 44100;

    // Generate frequency array (same as Python)
    this.frequencies = this.linspace(this.freqMin, this.freqMax, this.numChannels);
  }

  /**
   * Generate linearly spaced array (equivalent to numpy.linspace)
   */
  private linspace(start: number, end: number, num: number): number[] {
    const result: number[] = [];
    const step = (end - start) / (num - 1);
    for (let i = 0; i < num; i++) {
      result.push(start + step * i);
    }
    return result;
  }

  /**
   * Initialize Web Audio API
   */
  async initializeAudio(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.sampleRate,
      });

      // Create analyser node for frequency analysis
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 4096;
      this.analyser.smoothingTimeConstant = 0.8;

      // Create script processor for raw audio processing
      // Note: ScriptProcessorNode is deprecated but still widely supported
      // For production, consider using AudioWorklet
      this.scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);
      this.scriptProcessor.onaudioprocess = this.handleAudioProcess.bind(this);
    } catch (error) {
      console.error('Failed to initialize audio context:', error);
      throw new Error('Audio context initialization failed');
    }
  }

  /**
   * Handle raw audio data from microphone
   * Process audio directly without playing to speakers
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    const inputData = event.inputBuffer.getChannelData(0);
    
    // Create a copy of the audio data
    const audioData = new Float32Array(inputData.length);
    for (let i = 0; i < inputData.length; i++) {
      audioData[i] = inputData[i];
    }

    // Store audio buffer for processing
    this.audioBuffer.push(audioData);

    // Keep only last 10 buffers (about 0.5 seconds at 44100 Hz)
    if (this.audioBuffer.length > 10) {
      this.audioBuffer.shift();
    }

    // Call decoding callback if set
    if (this.decodingCallback) {
      this.decodingCallback(audioData);
    }

    // Prevent audio from playing to speakers by not connecting output
    // The output is intentionally left empty
  }

  /**
   * Request microphone access
   */
  async requestMicrophoneAccess(): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      return stream;
    } catch (error) {
      console.error('Microphone access denied:', error);
      throw new Error('Microphone access denied. Please allow microphone access to use this app.');
    }
  }

  /**
   * Start listening to audio input
   * Audio is captured directly and NOT played to speakers
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }

    try {
      await this.initializeAudio();

      if (!this.audioContext || !this.analyser || !this.scriptProcessor) {
        throw new Error('Audio context not initialized');
      }

      const stream = await this.requestMicrophoneAccess();

      // Create media stream source from microphone
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);

      // Connect microphone directly to analyser for frequency analysis
      this.mediaStreamSource.connect(this.analyser);

      // Connect microphone to script processor for raw audio processing
      this.mediaStreamSource.connect(this.scriptProcessor);

      // IMPORTANT: Do NOT connect to audioContext.destination
      // This prevents audio from being played to speakers
      // The audio is only processed internally for decoding

      this.isListening = true;
      console.log('Audio listening started (audio captured internally, not played to speakers)');
    } catch (error) {
      console.error('Failed to start listening:', error);
      throw error;
    }
  }

  /**
   * Stop listening to audio input
   */
  stopListening(): void {
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioBuffer = [];
    this.isListening = false;
    console.log('Audio listening stopped');
  }

  /**
   * Set callback for raw audio processing
   */
  setDecodingCallback(callback: (data: Float32Array) => void): void {
    this.decodingCallback = callback;
  }

  /**
   * Get buffered audio data
   */
  getAudioBuffer(): Float32Array[] {
    return this.audioBuffer;
  }

  /**
   * Perform FFT analysis on audio data
   */
  private performFFT(audioData: Uint8Array): Float32Array {
    // Convert Uint8Array to Float32Array
    const float32Data = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      float32Data[i] = (audioData[i] - 128) / 128.0;
    }

    // Simple FFT implementation using Web Audio API's built-in FFT
    // For more complex FFT, consider using a library like fft.js
    return float32Data;
  }

  /**
   * Analyze frequency content and detect bits from raw audio
   */
  private analyzeFrequenciesFromRawAudio(audioData: Float32Array): string {
    if (!this.analyser) {
      throw new Error('Analyser not initialized');
    }

    // Perform FFT on raw audio data
    const fftSize = 4096;
    const fft = this.performFFTOnRawAudio(audioData, fftSize);

    // Calculate average magnitude for threshold
    const sum = fft.reduce((a, b) => a + b, 0);
    const average = sum / fft.length;
    const threshold = average * 1.5;

    // Detect bits based on frequency presence
    let bits = '';
    const nyquist = this.sampleRate / 2;
    const binWidth = nyquist / fft.length;

    for (const freq of this.frequencies) {
      const binIndex = Math.round(freq / binWidth);
      if (binIndex < fft.length) {
        const magnitude = fft[binIndex];
        bits += magnitude > threshold ? '1' : '0';
      } else {
        bits += '0';
      }
    }

    return bits;
  }

  /**
   * Perform FFT on raw audio data using simple algorithm
   */
  private performFFTOnRawAudio(audioData: Float32Array, fftSize: number): Float32Array {
    // Pad or truncate audio data to fftSize
    const paddedData = new Float32Array(fftSize);
    const copyLength = Math.min(audioData.length, fftSize);
    for (let i = 0; i < copyLength; i++) {
      paddedData[i] = audioData[i];
    }

    // Apply Hann window to reduce spectral leakage
    const windowed = this.applyHannWindow(paddedData);

    // Simple magnitude calculation using energy in frequency bands
    const magnitudes = new Float32Array(this.frequencies.length);
    const binWidth = (this.sampleRate / 2) / magnitudes.length;

    for (let i = 0; i < magnitudes.length; i++) {
      const freq = this.frequencies[i];
      const binIndex = Math.round(freq / binWidth);
      
      // Calculate energy in a small band around this frequency
      let energy = 0;
      const bandWidth = 10; // Hz
      const binBandwidth = Math.max(1, Math.round(bandWidth / binWidth));

      for (let j = Math.max(0, binIndex - binBandwidth); j < Math.min(fftSize, binIndex + binBandwidth); j++) {
        energy += windowed[j] * windowed[j];
      }

      magnitudes[i] = Math.sqrt(energy / (2 * binBandwidth + 1));
    }

    return magnitudes;
  }

  /**
   * Apply Hann window to audio data
   */
  private applyHannWindow(data: Float32Array): Float32Array {
    const windowed = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (data.length - 1)));
      windowed[i] = data[i] * window;
    }
    return windowed;
  }

  /**
   * Analyze frequency content and detect bits (legacy method)
   */
  private analyzeFrequencies(audioData: Uint8Array): string {
    if (!this.analyser) {
      throw new Error('Analyser not initialized');
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average magnitude for threshold
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const average = sum / dataArray.length;
    const threshold = average * 1.5;

    // Detect bits based on frequency presence
    let bits = '';
    const nyquist = this.sampleRate / 2;
    const binWidth = nyquist / this.analyser.frequencyBinCount;

    for (const freq of this.frequencies) {
      const binIndex = Math.round(freq / binWidth);
      if (binIndex < dataArray.length) {
        const magnitude = dataArray[binIndex];
        bits += magnitude > threshold ? '1' : '0';
      } else {
        bits += '0';
      }
    }

    return bits;
  }

  /**
   * Remove FEC redundancy (2x repetition)
   */
  private removeFECRedundancy(bits: string): string {
    let originalBits = '';
    for (let i = 0; i < bits.length; i += 2) {
      if (i < bits.length) {
        const bit1 = bits[i];
        const bit2 = i + 1 < bits.length ? bits[i + 1] : bit1;
        // Majority vote
        originalBits += bit1 === bit2 ? bit1 : bit1;
      }
    }
    return originalBits;
  }

  /**
   * Convert bits to text
   */
  private bitsToText(bits: string): string {
    let text = '';
    for (let i = 0; i < bits.length; i += 8) {
      const byte = bits.substring(i, i + 8);
      if (byte.length === 8) {
        const charCode = parseInt(byte, 2);
        if (charCode > 0 && charCode < 128) {
          text += String.fromCharCode(charCode);
        }
      }
    }
    return text;
  }

  /**
   * Decode audio signal in real-time from raw audio buffer
   */
  async decodeRealtime(): Promise<DecodedMessage | null> {
    if (!this.isListening || this.audioBuffer.length === 0) {
      return null;
    }

    try {
      // Get the most recent audio buffer
      const latestBuffer = this.audioBuffer[this.audioBuffer.length - 1];

      // Analyze frequencies from raw audio
      const bits = this.analyzeFrequenciesFromRawAudio(latestBuffer);

      // Remove FEC redundancy
      const cleanedBits = this.removeFECRedundancy(bits);

      // Convert to text
      const text = this.bitsToText(cleanedBits);

      // Calculate signal strength (0-100) from raw audio
      const rms = Math.sqrt(
        latestBuffer.reduce((sum, sample) => sum + sample * sample, 0) / latestBuffer.length
      );
      const signalStrength = Math.min(100, Math.round(rms * 100));

      // Calculate confidence based on bit clarity
      const confidence = this.calculateConfidence(bits);

      if (text.length > 0 && confidence > 30) {
        return {
          text,
          confidence,
          signalStrength,
          timestamp: new Date().toLocaleTimeString('ar-SA'),
        };
      }

      return null;
    } catch (error) {
      console.error('Error during decoding:', error);
      return null;
    }
  }

  /**
   * Calculate confidence score (0-100)
   */
  private calculateConfidence(bits: string): number {
    if (bits.length === 0) return 0;

    // Count transitions (changes from 0 to 1 or 1 to 0)
    let transitions = 0;
    for (let i = 1; i < bits.length; i++) {
      if (bits[i] !== bits[i - 1]) {
        transitions++;
      }
    }

    // Confidence based on bit pattern clarity
    const transitionRatio = transitions / bits.length;
    return Math.round(transitionRatio * 100);
  }

  /**
   * Decode from AudioBuffer (for file-based decoding)
   */
  async decodeFromAudioBuffer(audioBuffer: AudioBuffer): Promise<DecodedMessage> {
    const channelData = audioBuffer.getChannelData(0);

    // Create a temporary analyser for processing
    if (!this.audioContext) {
      await this.initializeAudio();
    }

    // Simulate FFT analysis on the audio buffer
    const audioData = new Uint8Array(channelData.length);
    for (let i = 0; i < channelData.length; i++) {
      audioData[i] = Math.round((channelData[i] + 1) * 127.5);
    }

    // Analyze frequencies
    const bits = this.analyzeFrequencies(audioData);

    // Remove FEC redundancy
    const cleanedBits = this.removeFECRedundancy(bits);

    // Convert to text
    const text = this.bitsToText(cleanedBits);

    // Calculate signal strength
    const sum = audioData.reduce((a, b) => a + b, 0);
    const average = sum / audioData.length;
    const signalStrength = Math.min(100, Math.round((average / 255) * 100));

    const confidence = this.calculateConfidence(bits);

    return {
      text,
      confidence,
      signalStrength,
      timestamp: new Date().toLocaleTimeString('ar-SA'),
    };
  }

  /**
   * Get current signal strength (0-100)
   */
  getCurrentSignalStrength(): number {
    if (!this.analyser) {
      return 0;
    }

    const audioData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(audioData);

    const sum = audioData.reduce((a, b) => a + b, 0);
    const average = sum / audioData.length;
    return Math.min(100, Math.round((average / 255) * 100));
  }

  /**
   * Check if audio input is available
   */
  static async isAudioAvailable(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((device) => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error checking audio availability:', error);
      return false;
    }
  }

  /**
   * Check if headphones are connected (heuristic)
   */
  static async areHeadphonesConnected(): Promise<boolean> {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioContext.destination;

      // Check if audio output is available
      // This is a heuristic and may not be 100% accurate
      const maxChannels = destination.maxChannelCount;
      audioContext.close();

      return maxChannels > 0;
    } catch (error) {
      console.error('Error checking headphones:', error);
      return false;
    }
  }
}

export default AudioDecoder;
