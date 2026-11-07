Add-Type -AssemblyName System.Speech

$outDir = "C:\Users\Athavan\Desktop\Audio test"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$paragraphs = @(
    "Good morning, doctor. I brought my dog Bruno because he has not been feeling well for the past two days. He has been vomiting frequently and is not eating properly. Yesterday, he vomited around three times, and today morning, he vomited twice. Sometimes the vomit looks like a yellow liquid. He is also drinking very little water compared to usual.",
    "He had loose motion twice yesterday, and his stool is still not normal today. Yesterday evening, he ate some leftover chicken from our dinner. I'm not sure whether it was fresh. Normally, Bruno is very active and likes running around the house, but since yesterday, he has been very tired and mostly lying on the floor.",
    "Doctor, is this something serious? He has received all his regular vaccinations, and his last vaccination was around six months ago.",
    "Okay, doctor. Please examine him and let me know what the problem could be.",
    "I understand. Do you think it could be a stomach infection or something related to the food he ate?",
    "What tests do you recommend to identify the exact problem? Will he need a blood test or any other laboratory investigation?",
    "Doctor, what about medication? Does he need any treatment to stop the vomiting?",
    "Should I give him food and water normally at home, or should I follow any special diet?",
    "Okay, doctor. I will follow your instructions. Please let me know when we should come back for a follow-up consultation.",
    "Thank you, doctor. I hope Bruno feels better soon."
)

function Generate-Wav($voiceName, $fileName) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SelectVoice($voiceName)
    $synth.Rate = 0
    $synth.Volume = 100

    $targetFile = Join-Path $outDir $fileName
    $audioFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth.SetOutputToWaveFile($targetFile, $audioFormat)

    $builder = New-Object System.Speech.Synthesis.PromptBuilder
    for ($i = 0; $i -lt $paragraphs.Count; $i++) {
        $builder.AppendText($paragraphs[$i])
        if ($i -lt ($paragraphs.Count - 1)) {
            $builder.AppendBreak([TimeSpan]::FromMilliseconds(1200))
        }
    }

    $synth.Speak($builder)
    $synth.Dispose()

    $item = Get-Item $targetFile
    Write-Host "Generated: $fileName ($([Math]::Round($item.Length / 1MB, 2)) MB, Voice: $voiceName)" -ForegroundColor Green
}

# 1. Main audio (Microsoft David)
Generate-Wav "Microsoft David Desktop" "bruno_consultation.wav"

# 2. Female voice audio (Microsoft Zira)
Generate-Wav "Microsoft Zira Desktop" "bruno_consultation_female.wav"
