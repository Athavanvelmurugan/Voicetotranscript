import os
import subprocess
import imageio_ffmpeg

YOUTUBE_URL = "https://youtu.be/wHAKLSSc6P8?si=K2d386w4nTguU8Eh"
OUTPUT_DIR = os.path.abspath("frontend/test-assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)
RAW_FILE = os.path.join(OUTPUT_DIR, "counselling_raw.webm")
WAV_FILE = os.path.join(OUTPUT_DIR, "counselling_audio.wav")
SAMPLE_WAV = os.path.join(OUTPUT_DIR, "counselling_sample_30s.wav")

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
print(f"Using ffmpeg from: {ffmpeg_exe}")

# 1. Download audio from YouTube using python -m yt_dlp
print(f"Downloading audio from {YOUTUBE_URL}...")
subprocess.run([
    "python", "-m", "yt_dlp",
    "-f", "ba",
    "-o", RAW_FILE,
    "--force-overwrites",
    YOUTUBE_URL
], check=True)
print(f"Downloaded raw audio to: {RAW_FILE}")

# 2. Convert to standard 16-bit 44.1kHz mono WAV (compatible with Chromium's --use-file-for-fake-audio-capture)
print(f"Converting raw audio to full WAV: {WAV_FILE}...")
subprocess.run([
    ffmpeg_exe, "-y", "-i", RAW_FILE,
    "-ac", "1", "-ar", "44100", WAV_FILE
], check=True)
print("Full WAV conversion complete.")

# 3. Create a 30s sample WAV for quick automated E2E test runs
print(f"Extracting 30s sample WAV: {SAMPLE_WAV}...")
subprocess.run([
    ffmpeg_exe, "-y", "-i", WAV_FILE,
    "-t", "30", "-ac", "1", "-ar", "44100", SAMPLE_WAV
], check=True)
print("30s sample WAV creation complete.")

