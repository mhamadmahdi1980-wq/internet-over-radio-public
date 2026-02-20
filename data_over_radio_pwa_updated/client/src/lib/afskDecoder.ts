/**
 * AFSK Audio Decoder - فك تشفير نغمات AFSK من الميكروفون
 * يعمل بدون إنترنت وبدون أي API خارجي
 * Audio Frequency Shift Keying Decoder
 */

interface AFSKConfig {
  markFreq?: number;      // تردد البت 1 (عادة 1200 Hz)
  spaceFreq?: number;     // تردد البت 0 (عادة 2200 Hz)
  baudRate?: number;      // سرعة البث (عادة 1200 baud)
  sampleRate?: number;    // معدل العينات (عادة 44100 Hz)
  threshold?: number;     // عتبة الكشف
}

export class AFSKDecoder {
  private markFreq: number;
  private spaceFreq: number;
  private baudRate: number;
  private sampleRate: number;
  private threshold: number;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isListening: boolean = false;
  private decodedBits: string = '';
  private decodedText: string = '';
  private onTextDecoded: ((text: string) => void) | null = null;

  constructor(config: AFSKConfig = {}) {
    this.markFreq = config.markFreq || 1200;
    this.spaceFreq = config.spaceFreq || 2200;
    this.baudRate = config.baudRate || 1200;
    this.sampleRate = config.sampleRate || 44100;
    this.threshold = config.threshold || 0.5;
  }

  /**
   * طلب الوصول للميكروفون
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
      console.error('خطأ في الوصول للميكروفون:', error);
      throw new Error('لم يتمكن من الوصول للميكروفون. يرجى السماح بالوصول.');
    }
  }

  /**
   * بدء الاستماع للميكروفون
   */
  async startListening(): Promise<void> {
    if (this.isListening) {
      return;
    }

    try {
      // إنشاء Audio Context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: this.sampleRate,
      });

      // إنشاء Analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // إنشاء Script Processor
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = this.handleAudioProcess.bind(this);

      // الحصول على الميكروفون
      const stream = await this.requestMicrophoneAccess();

      // ربط الميكروفون
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.mediaStreamSource.connect(this.analyser);
      this.mediaStreamSource.connect(this.scriptProcessor);

      this.isListening = true;
      console.log('بدأ الاستماع للميكروفون...');
    } catch (error) {
      console.error('خطأ في بدء الاستماع:', error);
      throw error;
    }
  }

  /**
   * إيقاف الاستماع
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

    this.isListening = false;
    console.log('توقف الاستماع');
  }

  /**
   * معالجة بيانات الصوت الخام من الميكروفون
   */
  private handleAudioProcess(event: AudioProcessingEvent): void {
    const inputData = event.inputBuffer.getChannelData(0);
    const bits = this.decodeBits(inputData);
    
    if (bits) {
      this.decodedBits += bits;
      
      // محاولة تحويل البتات إلى نص كل 8 بتات
      while (this.decodedBits.length >= 8) {
        const byte = this.decodedBits.substring(0, 8);
        this.decodedBits = this.decodedBits.substring(8);
        
        try {
          const charCode = parseInt(byte, 2);
          if (charCode > 0 && charCode < 256) {
            const char = String.fromCharCode(charCode);
            this.decodedText += char;
            
            // استدعاء الـ callback عند فك تشفير نص جديد
            if (this.onTextDecoded) {
              this.onTextDecoded(this.decodedText);
            }
          }
        } catch (e) {
          console.error('خطأ في تحويل البت:', e);
        }
      }
    }
  }

  /**
   * فك تشفير البتات من بيانات الصوت
   */
  private decodeBits(audioData: Float32Array): string {
    if (!this.analyser) {
      return '';
    }

    // حساب طول الإطار الواحد (بناءً على معدل البث)
    const frameLength = Math.round(this.sampleRate / this.baudRate);
    
    if (audioData.length < frameLength) {
      return '';
    }

    let bits = '';

    // معالجة كل إطار
    for (let i = 0; i < audioData.length - frameLength; i += frameLength) {
      const frame = audioData.slice(i, i + frameLength);
      const bit = this.detectBit(frame);
      bits += bit;
    }

    return bits;
  }

  /**
   * كشف البت (0 أو 1) من إطار صوتي واحد
   */
  private detectBit(frame: Float32Array): string {
    // حساب الطاقة في تردد Mark (1200 Hz) و Space (2200 Hz)
    const markEnergy = this.calculateFrequencyEnergy(frame, this.markFreq);
    const spaceEnergy = this.calculateFrequencyEnergy(frame, this.spaceFreq);

    // إذا كانت طاقة Mark أعلى، فالبت = 1، وإلا = 0
    return markEnergy > spaceEnergy ? '1' : '0';
  }

  /**
   * حساب الطاقة في تردد معين باستخدام Goertzel Algorithm
   */
  private calculateFrequencyEnergy(frame: Float32Array, targetFreq: number): number {
    const N = frame.length;
    const k = (2 * Math.PI * targetFreq) / this.sampleRate;
    
    let s0 = 0, s1 = 0, s2 = 0;

    // Goertzel Algorithm
    for (let i = 0; i < N; i++) {
      s0 = frame[i] + 2 * Math.cos(k) * s1 - s2;
      s2 = s1;
      s1 = s0;
    }

    // حساب الطاقة
    const real = s1 - s2 * Math.cos(k);
    const imag = s2 * Math.sin(k);
    const energy = Math.sqrt(real * real + imag * imag) / N;

    return energy;
  }

  /**
   * تعيين دالة callback عند فك تشفير نص جديد
   */
  setOnTextDecoded(callback: (text: string) => void): void {
    this.onTextDecoded = callback;
  }

  /**
   * الحصول على النص المفكوك حالياً
   */
  getDecodedText(): string {
    return this.decodedText;
  }

  /**
   * إعادة تعيين النص المفكوك
   */
  resetDecodedText(): void {
    this.decodedText = '';
    this.decodedBits = '';
  }

  /**
   * التحقق من حالة الاستماع
   */
  isActive(): boolean {
    return this.isListening;
  }
}

/**
 * Morse Code Decoder - فك تشفير شفرة مورس من الصوت
 */
export class MorseDecoder {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private isListening: boolean = false;
  private decodedText: string = '';
  private onTextDecoded: ((text: string) => void) | null = null;
  private toneFreq: number = 800; // تردد نغمة مورس
  private threshold: number = 0.1;
  private ditDuration: number = 100; // مدة النقطة (ms)

  private morseMap: Record<string, string> = {
    '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
    '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
    '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
    '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
    '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
    '--..': 'Z', '-----': '0', '.----': '1', '..---': '2', '...--': '3',
    '....-': '4', '.....': '5', '-....': '6', '--...': '7', '---..': '8',
    '----.': '9'
  };

  async startListening(): Promise<void> {
    if (this.isListening) return;

    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = this.handleAudioProcess.bind(this);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });

      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.mediaStreamSource.connect(this.analyser);
      this.mediaStreamSource.connect(this.scriptProcessor);

      this.isListening = true;
      console.log('بدأ الاستماع لشفرة مورس...');
    } catch (error) {
      console.error('خطأ:', error);
      throw error;
    }
  }

  stopListening(): void {
    if (this.mediaStreamSource) this.mediaStreamSource.disconnect();
    if (this.scriptProcessor) this.scriptProcessor.disconnect();
    if (this.analyser) this.analyser.disconnect();
    if (this.audioContext) this.audioContext.close();
    this.isListening = false;
  }

  private handleAudioProcess(event: AudioProcessingEvent): void {
    const inputData = event.inputBuffer.getChannelData(0);
    const isTone = this.detectTone(inputData);
    
    if (isTone) {
      // معالجة النغمة (في نسخة متقدمة)
    }
  }

  private detectTone(frame: Float32Array): boolean {
    const rms = Math.sqrt(frame.reduce((sum, val) => sum + val * val, 0) / frame.length);
    return rms > this.threshold;
  }

  setOnTextDecoded(callback: (text: string) => void): void {
    this.onTextDecoded = callback;
  }

  getDecodedText(): string {
    return this.decodedText;
  }

  resetDecodedText(): void {
    this.decodedText = '';
  }

  isActive(): boolean {
    return this.isListening;
  }
}
