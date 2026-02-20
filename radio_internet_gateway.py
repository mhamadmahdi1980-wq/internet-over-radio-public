import base64
import zlib
import requests
from PIL import Image
import io
from advanced_fft_transmitter import FFTTransmitter

class RadioInternetGateway:
    def __init__(self):
        self.transmitter = FFTTransmitter()
        
    def compress_text(self, text):
        """ضغط النص باستخدام zlib لتقليل حجم البيانات المنقولة صوتياً"""
        compressed = zlib.compress(text.encode('utf-8'))
        return base64.b64encode(compressed).decode('utf-8')

    def compress_image(self, image_url, target_size=(64, 64)):
        """جلب صورة، تصغير حجمها بشدة، وضغطها للبث الصوتي"""
        try:
            response = requests.get(image_url)
            img = Image.open(io.BytesIO(response.content))
            # تصغير الصورة جداً لتناسب سرعة الراديو
            img.thumbnail(target_size)
            
            output = io.BytesIO()
            img.save(output, format="JPEG", quality=20) # جودة منخفضة جداً للتوفير
            img_data = output.getvalue()
            
            return base64.b64encode(img_data).decode('utf-8')
        except Exception as e:
            return f"Error: {str(e)}"

    def fetch_website_content(self, url):
        """جلب محتوى نصي من موقع ويب (مثل ويكيبيديا)"""
        try:
            # استخدام خدمة جلب نصوص بسيطة أو API
            response = requests.get(f"https://r.jina.ai/{url}") # خدمة تحويل المواقع لنصوص
            if response.status_code == 200:
                return response.text[:1000] # أول 1000 حرف فقط للتوفير
        except:
            return "Failed to fetch content."

    def prepare_broadcast_packet(self, data_type, content):
        """تجهيز حزمة بيانات (Packet) للبث"""
        # إضافة ترويسة (Header) ليعرف التطبيق نوع البيانات
        packet = f"TYPE:{data_type}|DATA:{content}|END"
        return packet

    def generate_radio_response(self, query):
        """المحرك الرئيسي: استلام الطلب -> جلب البيانات -> توليد الصوت"""
        print(f"Processing query: {query}")
        
        if "http" in query:
            content = self.fetch_website_content(query)
            compressed = self.compress_text(content)
            packet = self.prepare_broadcast_packet("WEB", compressed)
        elif "img:" in query:
            img_url = query.replace("img:", "")
            compressed_img = self.compress_image(img_url)
            packet = self.prepare_broadcast_packet("IMG", compressed_img)
        else:
            # بحث عام (Search)
            content = f"Search results for: {query} - Found 10 results. Summary: ..."
            compressed = self.compress_text(content)
            packet = self.prepare_broadcast_packet("TXT", compressed)

        # توليد الملف الصوتي النهائي
        filename = "internet_response.wav"
        self.transmitter.generate_signal(packet, filename, num_repeats=3)
        return filename

if __name__ == "__main__":
    gateway = RadioInternetGateway()
    # تجربة جلب موقع وتحويله لصوت
    gateway.generate_radio_response("https://en.wikipedia.org/wiki/Radio")
    print("Done! Audio packet 'internet_response.wav' generated.")
