import os
import subprocess
import imageio_ffmpeg

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
audio_dir = r"C:\Users\Athavan\Desktop\Audio test"

sources = [
    os.path.join(audio_dir, "ashwin_consultation.wav"),
    os.path.join(audio_dir, "bruno_consultation.wav"),
    os.path.join(audio_dir, "max_consultation.wav"),
]

for src in sources:
    if not os.path.exists(src):
        continue
    base = os.path.splitext(src)[0]

    # 1. MP3 conversion
    mp3_out = f"{base}.mp3"
    subprocess.run([ffmpeg_exe, "-y", "-i", src, "-codec:a", "libmp3lame", "-qscale:a", "2", mp3_out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"✅ Generated MP3 : {os.path.basename(mp3_out)} ({os.path.getsize(mp3_out) / (1024*1024):.2f} MB)")

    # 2. M4A (AAC) conversion
    m4a_out = f"{base}.m4a"
    subprocess.run([ffmpeg_exe, "-y", "-i", src, "-c:a", "aac", "-b:a", "128k", m4a_out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"✅ Generated M4A : {os.path.basename(m4a_out)} ({os.path.getsize(m4a_out) / (1024*1024):.2f} MB)")

    # 3. WebM (Opus) conversion
    webm_out = f"{base}.webm"
    subprocess.run([ffmpeg_exe, "-y", "-i", src, "-c:a", "libopus", "-b:a", "96k", webm_out], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    print(f"✅ Generated WebM: {os.path.basename(webm_out)} ({os.path.getsize(webm_out) / (1024*1024):.2f} MB)")

print("\n🎉 Multi-format conversion completed successfully!")

