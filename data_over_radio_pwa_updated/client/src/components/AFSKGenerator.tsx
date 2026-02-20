import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Volume2, Send, Download } from 'lucide-react';

interface AFSKGeneratorProps {
  onGenerateComplete?: (audioBlob: Blob) => void;
}

export function AFSKGenerator({ onGenerateComplete }: AFSKGeneratorProps) {
  const [text, setText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  /**
   * تحويل النص إلى بتات
   */
  const textToBits = (text: string): string => {
    let bits = '';
    for (let i = 0; i < text.length; i++) {
      bits += text.charCodeAt(i).toString(2).padStart(8, '0');
    }
    return bits;
  };

  /**
   * توليد موجة جيبية بتردد معين
   */
  const generateSineWave = (
    frequency: number,
    duration: number,
    sampleRate: number
  ): Float32Array => {
    const samples = Math.floor(duration * sampleRate);
    const wave = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      wave[i] = Math.sin((2 * Math.PI * frequency * i) / sampleRate);
    }
    return wave;
  };

  /**
   * توليد إشارة AFSK من البتات
   */
  const generateAFSK = async (bits: string) => {
    setIsGenerating(true);

    try {
      const sampleRate = 44100;
      const baudRate = 1200;
      const markFreq = 1200; // تردد البت 1
      const spaceFreq = 2200; // تردد البت 0
      const bitDuration = 1 / baudRate; // مدة البت الواحد

      // إنشاء Audio Context
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate,
      });

      const audioBuffer = audioContext.createBuffer(1, sampleRate * (bits.length * bitDuration + 1), sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      let sampleIndex = 0;

      // إضافة Preamble (نغمة بداية)
      const preambleWave = generateSineWave(18000, 0.1, sampleRate);
      for (let i = 0; i < preambleWave.length; i++) {
        channelData[sampleIndex++] = preambleWave[i] * 0.3;
      }

      // إضافة فجوة صغيرة
      sampleIndex += Math.floor(sampleRate * 0.05);

      // توليد البتات
      for (const bit of bits) {
        const freq = bit === '1' ? markFreq : spaceFreq;
        const wave = generateSineWave(freq, bitDuration, sampleRate);

        for (let i = 0; i < wave.length; i++) {
          if (sampleIndex < channelData.length) {
            channelData[sampleIndex++] = wave[i] * 0.3;
          }
        }
      }

      // تحويل إلى WAV
      const audioBlob = audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);

      if (onGenerateComplete) {
        onGenerateComplete(audioBlob);
      }
    } catch (error) {
      console.error('خطأ في توليد AFSK:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * تحويل AudioBuffer إلى WAV
   */
  const audioBufferToWav = (audioBuffer: AudioBuffer): Blob => {
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const numChannels = 1;
    const bitsPerSample = 16;

    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    const preEncoded = encodeWAV(channelData, format, sampleRate, numChannels, bitsPerSample);
    const blob = new Blob([preEncoded], { type: 'audio/wav' });

    return blob;
  };

  /**
   * ترميز WAV
   */
  const encodeWAV = (
    samples: Float32Array,
    format: number,
    sampleRate: number,
    numChannels: number,
    bitsPerSample: number
  ): ArrayBuffer => {
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numChannels * bytesPerSample;

    const preEncoded = interleave(samples);
    const dataLength = preEncoded.length * bytesPerSample;
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    // WAV header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    // Write samples
    let offset = 44;
    const volume = 0.8;
    for (let i = 0; i < preEncoded.length; i++) {
      view.setInt16(offset, preEncoded[i] < 0 ? preEncoded[i] * 0x8000 : preEncoded[i] * 0x7fff, true);
      offset += 2;
    }

    return buffer;
  };

  /**
   * دمج القنوات
   */
  const interleave = (samples: Float32Array): Float32Array => {
    return samples;
  };

  const handleGenerate = () => {
    if (text.trim()) {
      const bits = textToBits(text);
      generateAFSK(bits);
    }
  };

  const handleDownload = () => {
    if (audioUrl) {
      const a = document.createElement('a');
      a.href = audioUrl;
      a.download = 'afsk_signal.wav';
      a.click();
    }
  };

  return (
    <Card className="p-6 bg-gradient-to-br from-cyan-50 to-blue-50 border-2 border-cyan-200">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Volume2 size={24} className="text-cyan-600" />
        توليد نغمات AFSK
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">النص المراد إرساله:</label>
          <Input
            type="text"
            placeholder="اكتب الرسالة هنا..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={isGenerating}
            className="w-full"
          />
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !text.trim()}
            className="flex-1 bg-cyan-600 hover:bg-cyan-700"
          >
            <Send size={18} className="mr-2" />
            {isGenerating ? 'جاري التوليد...' : 'توليد الإشارة'}
          </Button>

          {audioUrl && (
            <Button
              onClick={handleDownload}
              variant="outline"
              className="flex-1"
            >
              <Download size={18} className="mr-2" />
              تحميل WAV
            </Button>
          )}
        </div>

        {audioUrl && (
          <div>
            <label className="block text-sm font-medium mb-2">الإشارة المولدة:</label>
            <audio
              ref={audioRef}
              src={audioUrl}
              controls
              className="w-full"
            />
          </div>
        )}

        <div className="bg-blue-100 border border-blue-300 rounded p-3 text-sm text-blue-800">
          <p className="font-medium mb-1">💡 نصيحة:</p>
          <p>شغل هذه الإشارة بجانب جهاز إرسال FM أو وضعها بجانب ميكروفون الهاتف الآخر الذي يستقبل النغمات.</p>
        </div>
      </div>
    </Card>
  );
}
