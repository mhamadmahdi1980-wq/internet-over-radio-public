import time
import os
import subprocess

def stream_audio(filename="live_broadcast.wav"):
    """
    بث الملف الصوتي بشكل مستمر. 
    يمكن استخدام ffmpeg للبث إلى خادم Icecast أو حتى بثه محلياً.
    لأغراض العرض، سنقوم بتشغيله في حلقة مفرغة (Loop).
    """
    if not os.path.exists(filename):
        print(f"File {filename} not found!")
        return

    print(f"Starting continuous stream of {filename}...")
    
    # مثال لاستخدام ffmpeg للبث إلى خادم Icecast (يتطلب إعدادات الخادم)
    # command = f"ffmpeg -re -i {filename} -f mp3 icecast://user:pass@host:port/mount"
    
    # لمحاكاة البث، سنقوم فقط بطباعة رسالة في كل دورة
    while True:
        try:
            print(f"Streaming cycle started at {time.ctime()}")
            # هنا نقوم بتشغيل السكربت الذي يحدث البيانات كل ساعة مثلاً
            subprocess.run(["python3", "auto_broadcast_generator.py"])
            
            # محاكاة "البث" عبر الانتظار لمدة طول الملف الصوتي
            # في الواقع، ffmpeg سيتولى البث المستمر
            time.sleep(300) # انتظار 5 دقائق قبل التحديث القادم
        except KeyboardInterrupt:
            print("Streaming stopped by user.")
            break

if __name__ == "__main__":
    stream_audio()
