/**
 * Hardware Detector for Data-Over-Radio System
 * Detects headphones, antennas, and audio input devices
 */

export interface HardwareStatus {
  hasHeadphones: boolean;
  hasAntenna: boolean;
  hasAudioInput: boolean;
  audioDevices: MediaDeviceInfo[];
  isAndroid: boolean;
  isIOS: boolean;
  isDesktop: boolean;
  deviceType: 'android' | 'ios' | 'desktop' | 'unknown';
}

export class HardwareDetector {
  /**
   * Detect if headphones are connected
   * This is a heuristic and may not be 100% accurate
   */
  static async detectHeadphones(): Promise<boolean> {
    try {
      // Method 1: Check audio output using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioContext.destination;

      // Check if audio output is available
      const hasAudioOutput = destination.maxChannelCount > 0;
      audioContext.close();

      if (!hasAudioOutput) {
        return false;
      }

      // Method 2: For Android devices, check if audio output is connected
      // This is more reliable on Android
      if (this.isAndroidDevice()) {
        return await this.detectHeadphonesAndroid();
      }

      // Method 3: Check for audio devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioOutputDevices = devices.filter((device) => device.kind === 'audiooutput');

      // If there are multiple audio output devices, headphones are likely connected
      return audioOutputDevices.length > 1;
    } catch (error) {
      console.warn('Error detecting headphones:', error);
      return false;
    }
  }

  /**
   * Detect headphones on Android devices
   */
  private static async detectHeadphonesAndroid(): Promise<boolean> {
    try {
      // Try to access audio output
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const destination = audioContext.destination;

      // Create a test oscillator
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      // Set volume to 0 to avoid audible sound
      gain.gain.value = 0;

      oscillator.connect(gain);
      gain.connect(destination);

      // Try to start the oscillator
      oscillator.start();
      oscillator.stop();

      audioContext.close();

      // If we got here without errors, audio output is available
      return true;
    } catch (error) {
      console.warn('Error detecting Android headphones:', error);
      return false;
    }
  }

  /**
   * Detect antenna availability
   * On many Android devices, the FM radio antenna is built-in
   */
  static async detectAntenna(): Promise<boolean> {
    try {
      // Check if device is Android
      if (this.isAndroidDevice()) {
        // Android devices often have built-in FM antennas
        // However, they may need headphones connected as an antenna
        // This is a heuristic check
        return true;
      }

      // iOS devices may have antenna in headphones
      if (this.isIOSDevice()) {
        // Check if headphones are connected
        return await this.detectHeadphones();
      }

      // Desktop devices typically don't have built-in antennas
      return false;
    } catch (error) {
      console.warn('Error detecting antenna:', error);
      return false;
    }
  }

  /**
   * Get all audio input devices
   */
  static async getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'audioinput');
    } catch (error) {
      console.error('Error getting audio input devices:', error);
      return [];
    }
  }

  /**
   * Get all audio output devices
   */
  static async getAudioOutputDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((device) => device.kind === 'audiooutput');
    } catch (error) {
      console.error('Error getting audio output devices:', error);
      return [];
    }
  }

  /**
   * Detect device type
   */
  static getDeviceType(): 'android' | 'ios' | 'desktop' | 'unknown' {
    if (this.isAndroidDevice()) {
      return 'android';
    }
    if (this.isIOSDevice()) {
      return 'ios';
    }
    if (this.isDesktopDevice()) {
      return 'desktop';
    }
    return 'unknown';
  }

  /**
   * Check if device is Android
   */
  static isAndroidDevice(): boolean {
    return /Android/i.test(navigator.userAgent);
  }

  /**
   * Check if device is iOS
   */
  static isIOSDevice(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  /**
   * Check if device is desktop
   */
  static isDesktopDevice(): boolean {
    return !this.isAndroidDevice() && !this.isIOSDevice();
  }

  /**
   * Get full hardware status
   */
  static async getHardwareStatus(): Promise<HardwareStatus> {
    const audioDevices = await this.getAudioInputDevices();
    const hasHeadphones = await this.detectHeadphones();
    const hasAntenna = await this.detectAntenna();
    const hasAudioInput = audioDevices.length > 0;
    const deviceType = this.getDeviceType();

    return {
      hasHeadphones,
      hasAntenna,
      hasAudioInput,
      audioDevices,
      isAndroid: this.isAndroidDevice(),
      isIOS: this.isIOSDevice(),
      isDesktop: this.isDesktopDevice(),
      deviceType,
    };
  }

  /**
   * Check if headphones are required for this device
   */
  static async areHeadphonesRequired(): Promise<boolean> {
    const status = await this.getHardwareStatus();

    // On Android, headphones are often required as antenna
    if (status.isAndroid) {
      return true;
    }

    // On iOS, headphones are required for FM radio
    if (status.isIOS) {
      return true;
    }

    // On desktop, headphones are not required
    return false;
  }

  /**
   * Get human-readable message about hardware requirements
   */
  static async getHardwareRequirementMessage(): Promise<string> {
    const status = await this.getHardwareStatus();

    if (status.isAndroid) {
      if (!status.hasHeadphones) {
        return 'يرجى توصيل سماعات الرأس أو سماعات الأذن. على أجهزة Android، تعمل السماعات كهوائي لاستقبال إشارات الراديو.';
      }
      return 'تم اكتشاف السماعات. جاهز للاستقبال!';
    }

    if (status.isIOS) {
      if (!status.hasHeadphones) {
        return 'يرجى توصيل سماعات الرأس أو سماعات الأذن. على أجهزة iPhone/iPad، تعمل السماعات كهوائي لاستقبال إشارات الراديو.';
      }
      return 'تم اكتشاف السماعات. جاهز للاستقبال!';
    }

    if (status.isDesktop) {
      if (!status.hasAudioInput) {
        return 'لم يتم اكتشاف جهاز إدخال صوتي. يرجى توصيل ميكروفون أو جهاز استقبال راديو.';
      }
      return 'تم اكتشاف جهاز إدخال صوتي. جاهز للاستقبال!';
    }

    return 'لم يتمكن النظام من تحديد نوع الجهاز. يرجى التأكد من توصيل جهاز الإدخال الصوتي.';
  }

  /**
   * Monitor headphone connection changes
   */
  static onHeadphoneConnectionChange(callback: (connected: boolean) => void): () => void {
    let previousStatus = false;

    const checkHeadphones = async () => {
      const currentStatus = await this.detectHeadphones();
      if (currentStatus !== previousStatus) {
        previousStatus = currentStatus;
        callback(currentStatus);
      }
    };

    // Check every 2 seconds
    const interval = setInterval(checkHeadphones, 2000);

    // Also check on audio context state change
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioContext.addEventListener('statechange', () => {
      checkHeadphones();
    });

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  }

  /**
   * Get device-specific recommendations
   */
  static async getDeviceRecommendations(): Promise<string[]> {
    const status = await this.getHardwareStatus();
    const recommendations: string[] = [];

    if (status.isAndroid) {
      recommendations.push('استخدم سماعات رأس بسلك (3.5 مم) للحصول على أفضل استقبال');
      recommendations.push('تأكد من إدراج السماعات بالكامل في منفذ الصوت');
      recommendations.push('قد تحتاج إلى تطبيق FM راديو منفصل للعمل مع هذا التطبيق');
    }

    if (status.isIOS) {
      recommendations.push('استخدم سماعات Apple الأصلية أو سماعات متوافقة');
      recommendations.push('تأكد من تفعيل Bluetooth إذا كنت تستخدم سماعات لاسلكية');
      recommendations.push('قد تحتاج إلى تطبيق FM راديو منفصل للعمل مع هذا التطبيق');
    }

    if (status.isDesktop) {
      recommendations.push('استخدم ميكروفون أو جهاز استقبال راديو USB');
      recommendations.push('تأكد من أن الجهاز متصل بشكل صحيح');
      recommendations.push('تحقق من إعدادات الصوت في نظام التشغيل');
    }

    return recommendations;
  }
}

export default HardwareDetector;
