import numpy as np
from scipy.io import wavfile
from scipy.fft import fft
import os

class RadioReceiver:
    def __init__(self, sample_rate=44100, num_channels=1000, freq_min=300, freq_max=15000):
        """
        إعداد جهاز الاستقبال لفك تشفير الـ 1000 قناة.
        """
        self.sample_rate = sample_rate
        self.num_channels = num_channels
        self.freq_min = freq_min
        self.freq_max = freq_max
        self.frequencies = np.linspace(self.freq_min, self.freq_max, self.num_channels)

    def decode_bits_to_text(self, bits):
        """تحويل سلسلة البتات إلى نص مع معالجة FEC."""
        # 1. إزالة FEC (تكرار البتات)
        # نأخذ كل بتين متتاليين، إذا كان أحدهما 1 نعتبره 1 (تصحيح بسيط)
        cleaned_bits = ""
        for i in range(0, len(bits), 2):
            if i + 1 < len(bits):
                # تصحيح الخطأ البسيط: إذا كان أحد البتات المكررة 1، نعتبره 1
                if bits[i] == '1' or bits[i+1] == '1':
                    cleaned_bits += '1'
                else:
                    cleaned_bits += '0'
        
        # 2. تحويل البتات إلى أحرف
        text = ""
        for i in range(0, len(cleaned_bits), 8):
            byte = cleaned_bits[i:i+8]
            if len(byte) == 8:
                try:
                    char_code = int(byte, 2)
                    if char_code > 0: # تجاهل الأصفار الفارغة
                        text += chr(char_code)
                except ValueError:
                    continue
        return text

    def analyze_frame(self, signal_chunk):
        """تحليل إطار صوتي واستخراج البتات باستخدام FFT."""
        n = len(signal_chunk)
        # استخدام نافذة هان لتقليل التسرب الطيفي
        window = np.hanning(n)
        yf = fft(signal_chunk * window)
        xf = np.linspace(0.0, self.sample_rate/2, n//2)
        magnitudes = 2.0/n * np.abs(yf[0:n//2])
        
        bits = ""
        # عتبة كشف محسنة بناءً على أعلى طاقة في الإشارة
        max_mag = np.max(magnitudes)
        threshold = max_mag * 0.3 # 30% من القمة
        
        for freq in self.frequencies:
            idx = np.argmin(np.abs(xf - freq))
            if magnitudes[idx] > threshold:
                bits += '1'
            else:
                bits += '0'
        return bits

    def decode_signal(self, filename):
        """فك تشفير ملف WAV بالكامل مع تخطي Preamble."""
        if not os.path.exists(filename):
            return None
            
        sample_rate, data = wavfile.read(filename)
        if data.dtype == np.int16:
            data = data.astype(np.float32) / 32767.0
            
        frame_size = int(sample_rate * 0.2)
        gap_size = int(sample_rate * 0.05)
        preamble_size = int(sample_rate * 0.1)
        
        all_bits = ""
        
        # نبدأ من بعد الـ Preamble الأول مباشرة في الملف التجريبي
        i = preamble_size
        
        while i < len(data) - frame_size:
            # التأكد من أننا لسنا في منطقة الصمت (Gap) أو الـ Preamble التالي
            chunk = data[i:i+frame_size]
            if np.max(np.abs(chunk)) > 0.01: # إشارة نشطة
                bits = self.analyze_frame(chunk)
                all_bits += bits
                i += (frame_size + gap_size)
            else:
                i += gap_size # تخطي الصمت
                
            if len(all_bits) > 10000: break
                
        return self.decode_bits_to_text(all_bits)

if __name__ == "__main__":
    receiver = RadioReceiver()
    decoded_text = receiver.decode_signal("test_radio.wav")
    print(f"النص المستخرج: {decoded_text}")
