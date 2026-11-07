import os
import asyncio
import subprocess
import edge_tts
import imageio_ffmpeg

OUTPUT_DIR = r"C:\Users\Athavan\Desktop\Audio test"
os.makedirs(OUTPUT_DIR, exist_ok=True)
ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()

SCRIPTS = {
    "tamil": {
        "voice": "ta-IN-ValluvarNeural",
        "base_name": "consultation_tamil",
        "text": """வணக்கம் டாக்டர் தனுஷ். என் நாய் அமுலுக்கு கடந்த இரண்டு நாட்களாக வாந்தி மற்றும் சோர்வு இருக்கிறது. சரியாக சாப்பிடவில்லை.
வணக்கம் ரமேஷ். நான் அமுலை பரிசோதிக்கிறேன். உடல் வெப்பநிலை 102 டிகிரி இருக்கிறது, லேசான நீர்ச்சத்து குறைபாடு உள்ளது. வயிற்றுப் பகுதியை பரிசோதிக்கும்போது வலி தெரிகிறது.
டாக்டர், இதற்கு ரத்தப் பரிசோதனை செய்ய வேண்டுமா? ஏதாவது தீவிரமான நோயா?
பயப்பட வேண்டாம். Complete Blood Count மற்றும் சீரம் பயோகெமிஸ்ட்ரி செய்வோம். வாந்தியைக் கட்டுப்படுத்த Maropitant ஊசி மற்றும் IV திரவம் கொடுக்கிறேன்.
சரி டாக்டர். வீட்டில் என்ன உணவு கொடுக்க வேண்டும்?
இன்று மாலை வரை உணவு கொடுக்க வேண்டாம். அதன் பிறகு வேகவைத்த சாதம் மற்றும் சிக்கன் போன்ற எளிமையான உணவு கொடுங்கள். இரண்டு நாட்கள் கழித்து மீண்டும் வாருங்கள்."""
    },
    "hindi": {
        "voice": "hi-IN-MadhurNeural",
        "base_name": "consultation_hindi",
        "text": """नमस्ते डॉक्टर धनुष। मेरे कुत्ते शेरू को पिछले तीन दिनों से बुखार और बहुत तेज खांसी आ रही है। वह बहुत सुस्त है और खाना नहीं खा रहा है।
नमस्ते राजेश जी। मैं शेरू की जांच करता हूं। उसकी छाती से घरघराहट की आवाज आ रही है और तापमान 103 डिग्री है। यह कैनल कफ या रेस्पिरेटरी इन्फेक्शन हो सकता है।
डॉक्टर साहब, क्या हमें कोई ब्लड टेस्ट या एक्स-रे करवाने की जरूरत है?
हां, हमें सीबीसी और चेस्ट एक्स-रे करना चाहिए। अभी के लिए मैं कफ सिरप और एंटीबायोटिक जैसे Amoxicillin लिख रहा हूं।
इसे दवा दिन में कितनी बार देनी है और खाने के पहले या बाद में?
यह गोली दिन में दो बार खाने के बाद देनी है। शेरू को ठंडी हवा से बचाएं और गुनगुना पानी दें। पांच दिन बाद फॉलो-अप के लिए आइए।"""
    },
    "telugu": {
        "voice": "te-IN-MohanNeural",
        "base_name": "consultation_telugu",
        "text": """నమస్కారం డాక్టర్ ధనుష్ గారు. నా కుక్క బ్రూనో గత రెండు రోజులుగా తీవ్రమైన విరేచనాలు మరియు వాంతులతో బాధపడుతోంది. చాలా నీరసంగా ఉంది.
నమస్కారం సురేష్ గారు. నేను బ్రూనోను పరీక్షిస్తాను. కడుపు ఉబ్బరంగా ఉంది మరియు డీహైడ్రేషన్ ఉంది. ఏదైనా బయట పడేసిన ఆహారం తిన్నాడా?
అవును డాక్టర్, రెండు రోజుల క్రితం పార్కులో ఏదో చెత్త తిన్నాడు. రక్త పరీక్షలు ఏమైనా చేయించాలా డాక్టర్?
అవును, ఇన్ఫెక్షన్ స్థాయిని తెలుసుకోవడానికి Complete Blood Count మరియు ఎలక్ట్రోలైట్స్ టెస్ట్ చేద్దాం. డీహైడ్రేషన్ తగ్గించడానికి IV Fluid Therapy మరియు వాంతులకు Maropitant ఇంజెక్షన్ ఇస్తున్నాను.
సరే డాక్టర్, ఇంట్లో ఎలాంటి ఆహారం ఇవ్వాలి?
ఒక రోజంతా గంజి లేదా తేలికపాటి ఆహారం మాత్రమే ఇవ్వండి. మెడిసిన్స్ క్రమం తప్పకుండా వాడండి. పరిస్థితి మెరుగుపడకపోతే రేపు ఉదయం తీసుకురండి."""
    }
}

async def generate_language_audio(lang_key, data):
    base_name = data["base_name"]
    voice = data["voice"]
    text = data["text"]

    mp3_path = os.path.join(OUTPUT_DIR, f"{base_name}.mp3")
    wav_path = os.path.join(OUTPUT_DIR, f"{base_name}.wav")

    print(f"🎙️ Synthesizing {lang_key.capitalize()} audio using voice {voice}...")
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(mp3_path)
    print(f"✅ Generated MP3: {os.path.basename(mp3_path)} ({os.path.getsize(mp3_path)/1024:.1f} KB)")

    # Convert to 16-bit PCM WAV (24000Hz mono)
    subprocess.run([
        ffmpeg_exe, "-y", "-i", mp3_path,
        "-acodec", "pcm_s16le", "-ar", "24000", "-ac", "1",
        wav_path
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"✅ Generated WAV: {os.path.basename(wav_path)} ({os.path.getsize(wav_path)/(1024*1024):.2f} MB)")

async def main():
    print("🚀 Starting Multilingual Audio Generation (Tamil, Hindi, Telugu)...")
    for lang, data in SCRIPTS.items():
        await generate_language_audio(lang, data)
    print("\n🎉 Multilingual audio generation completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())

