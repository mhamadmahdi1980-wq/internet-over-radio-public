from advanced_fft_transmitter import FFTTransmitter
from advanced_radio_receiver import RadioReceiver
import os
import time

def run_test():
    print("--- بدء اختبار نظام راديو البيانات (Data-Over-Radio) ---")
    
    # 1. إعداد السيرفر والمستقبل
    transmitter = FFTTransmitter()
    receiver = RadioReceiver()
    
    # 2. البيانات المراد إرسالها
    original_text = "Manus Data-Over-Radio: 1000 FFT Channels Success!"
    print(f"النص الأصلي: {original_text}")
    
    # 3. توليد الإشارة (السيرفر)
    filename = "test_system.wav"
    print("\n[السيرفر] جاري توليد الإشارة...")
    transmitter.generate_signal(original_text, filename, num_repeats=1)
    
    # 4. فك التشفير (المستقبل)
    print("\n[المستقبل] جاري استقبال وفك تشفير الإشارة...")
    # محاكاة لعملية الاستقبال
    decoded_text = receiver.decode_signal(filename)
    
    # 5. عرض النتائج والمقارنة
    print("\n--- النتائج النهائية ---")
    print(f"النص المستخرج: {decoded_text}")
    
    if original_text in decoded_text:
        print("\n✅ نجاح الاختبار! تم استعادة البيانات بدقة 100%.")
    else:
        print("\n⚠️ فشل الاختبار جزئياً أو كلياً. يرجى مراجعة العتبات (Thresholds).")
        # عرض الجزء المستخرج للمقارنة
        print(f"طول النص الأصلي: {len(original_text)}")
        print(f"طول النص المستخرج: {len(decoded_text)}")

if __name__ == "__main__":
    run_test()
