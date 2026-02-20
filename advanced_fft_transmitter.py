import numpy as np
from scipy.io import wavfile
import struct
import time
import os

class FFTTransmitter:
    def __init__(self, sample_rate=44100, num_channels=1000, freq_min=300, freq_max=15000):
        """
        إعداد جهاز الإرسال بـ 1000 قناة ترددية متوازية.
        """
        self.sample_rate = sample_rate
        self.num_channels = num_channels
        self.freq_min = freq_min
        self.freq_max = freq_max
        
        # توليد الترددات لكل قناة (1000 قناة موزعة خطياً)
        self.frequencies = np.linspace(self.freq_min, self.freq_max, self.num_channels)
        
    def text_to_bits(self, text):
        """تحويل النص إلى سلسلة من البتات مع إضافة FEC (تكرار البتات كشكل بسيط من الحماية)."""
        # ضغط بسيط: إزالة المسافات الزائدة (مثال للضغط)
        compressed_text = " ".join(text.split())
        
        bits = ""
        for char in compressed_text:
            bits += bin(ord(char))[2:].zfill(8)
            
        # إضافة FEC: تكرار كل بت مرتين (Repetition Code) لضمان الوصول
        # في المشاريع المتقدمة نستخدم Raptor Codes أو Reed-Solomon
        fec_bits = ""
        for b in bits:
            fec_bits += b * 2 # تكرار البت للحماية
            
        return fec_bits

    def generate_frame(self, bits, duration=0.1):
        """
        توليد إطار صوتي واحد يحتوي على البيانات (نغمات متوازية).
        """
        t = np.linspace(0, duration, int(self.sample_rate * duration), endpoint=False)
        signal = np.zeros_like(t)
        
        # التأكد من أن عدد البتات لا يتجاوز عدد القنوات
        active_bits = bits[:self.num_channels]
        
        # جمع الموجات الجيبية للقنوات النشطة (التي قيمتها 1)
        for i, bit in enumerate(active_bits):
            if bit == '1':
                # استخدام تردد القناة i
                signal += np.sin(2 * np.pi * self.frequencies[i] * t)
        
        # تطبيع الإشارة لمنع التشويه (Normalization)
        if np.max(np.abs(signal)) > 0:
            signal = signal / np.max(np.abs(signal))
            
        return signal

    def generate_signal(self, text, filename="output.wav", frame_duration=0.2, num_repeats=3):
        """
        توليد ملف صوتي كامل يحتوي على النص المشفر مع ميزة Data Carousel (إعادة البث).
        """
        bits = self.text_to_bits(text)
        print(f"جاري تحويل النص إلى {len(bits)} بت (شاملة FEC)...")
        
        all_signals = []
        
        # تنفيذ Data Carousel: تكرار البث بالكامل لضمان الالتقاط
        for repeat in range(num_repeats):
            print(f"--- جاري توليد الدورة {repeat + 1} من البث (Carousel) ---")
            
            # إضافة إشارة بداية (Preamble) - تردد عالي جداً لتمييز بداية البث
            preamble_t = np.linspace(0, 0.1, int(self.sample_rate * 0.1), endpoint=False)
            preamble = np.sin(2 * np.pi * 18000 * preamble_t) # 18kHz
            all_signals.append(preamble)
            
            # تقسيم البتات إلى إطارات
            for i in range(0, len(bits), self.num_channels):
                frame_bits = bits[i:i + self.num_channels]
                if len(frame_bits) < self.num_channels:
                    frame_bits = frame_bits.ljust(self.num_channels, '0')
                
                frame_signal = self.generate_frame(frame_bits, duration=frame_duration)
                all_signals.append(frame_signal)
                
                # فجوة صغيرة
                all_signals.append(np.zeros(int(self.sample_rate * 0.05)))
            
            # فجوة كبيرة بين الدورات
            all_signals.append(np.zeros(int(self.sample_rate * 0.5)))
            
        # دمج كل الإطارات
        final_signal = np.concatenate(all_signals)
        final_signal_int = np.int16(final_signal * 32767)
        
        wavfile.write(filename, self.sample_rate, final_signal_int)
        print(f"تم حفظ ملف البث الدوري بنجاح: {filename}")
        return filename

if __name__ == "__main__":
    # تجربة سريعة
    transmitter = FFTTransmitter()
    test_text = "Data-Over-Radio Test: 1000 Channels FFT"
    transmitter.generate_signal(test_text, "test_radio.wav")
