Add-Type -AssemblyName System.Speech

$outDir = "C:\Users\Athavan\Desktop\Voice to transcript\tests\asr-audit\audio"

function Generate-SilenceWav($fileName, $seconds) {
    $sampleRate = 16000
    $channels = 1
    $bitsPerSample = 16
    $byteRate = $sampleRate * $channels * ($bitsPerSample / 8)
    $blockAlign = $channels * ($bitsPerSample / 8)
    $dataSize = $seconds * $byteRate
    $fileSize = 36 + $dataSize

    $target = Join-Path $outDir $fileName
    $fs = [System.IO.File]::Create($target)
    $bw = New-Object System.IO.BinaryWriter($fs)

    # RIFF header
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("RIFF"))
    $bw.Write([int32]$fileSize)
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("WAVE"))

    # fmt subchunk
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("fmt "))
    $bw.Write([int32]16) # Subchunk1Size (16 for PCM)
    $bw.Write([int16]1)  # AudioFormat (1 for PCM)
    $bw.Write([int16]$channels)
    $bw.Write([int32]$sampleRate)
    $bw.Write([int32]$byteRate)
    $bw.Write([int16]$blockAlign)
    $bw.Write([int16]$bitsPerSample)

    # data subchunk
    $bw.Write([System.Text.Encoding]::ASCII.GetBytes("data"))
    $bw.Write([int32]$dataSize)
    $zeros = New-Object byte[] 4096
    $remaining = $dataSize
    while ($remaining -gt 0) {
        $toWrite = [Math]::Min($remaining, 4096)
        $bw.Write($zeros, 0, $toWrite)
        $remaining -= $toWrite
    }

    $bw.Close()
    $fs.Close()
    Write-Host "Created silence file: $fileName ($seconds s)"
}

function Generate-SpeechWav($fileName, $textList) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    $synth.SelectVoice("Microsoft David Desktop")
    $synth.Rate = 0
    $synth.Volume = 100

    $target = Join-Path $outDir $fileName
    $format = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $synth.SetOutputToWaveFile($target, $format)

    $builder = New-Object System.Speech.Synthesis.PromptBuilder
    foreach ($txt in $textList) {
        $builder.AppendText($txt)
        $builder.AppendBreak([TimeSpan]::FromMilliseconds(800))
    }

    $synth.Speak($builder)
    $synth.Dispose()
    Write-Host "Created speech file: $fileName"
}

# 1. Silence 60s
Generate-SilenceWav "silence_60s.wav" 60

# 2. 20 Drugs Script
$drugs = @(
    "Please administer Amoxicillin.",
    "We need to give Clavamox.",
    "Start on Metronidazole.",
    "Prescribe Doxycycline.",
    "Administer Meloxicam.",
    "Give Carprofen for pain.",
    "Start Prednisolone.",
    "Use Dexamethasone for inflammation.",
    "Dispense Maropitant for vomiting.",
    "Start Ondansetron.",
    "Give Pantoprazole for stomach protection.",
    "Administer Ranitidine.",
    "Prescribe Enrofloxacin.",
    "Start Cephalexin.",
    "Use Gabapentin.",
    "Give Tramadol.",
    "Dispense Apoquel for itching.",
    "Administer Cytopoint.",
    "Start Levothyroxine.",
    "Prescribe Furosemide."
)
Generate-SpeechWav "drugs_20.wav" $drugs

# 3. Doses and Units Script
$doses = @(
    "Administer meloxicam zero point two mg per kg.",
    "Prescribe levothyroxine 25 micrograms BID.",
    "Give half a tablet twice daily.",
    "Administer 500 ml over 4 hours."
)
Generate-SpeechWav "doses_units.wav" $doses

# 4. Negation Script
$negation = @(
    "There is no vomiting, no diarrhea, and we stopped Metacam two days ago.",
    "Patient is not dehydrated and does not have fever."
)
Generate-SpeechWav "negation.wav" $negation

# 5. Lab Terms Script
$labs = @(
    "We performed a Complete Blood Count CBC.",
    "Check ALT, ALP, BUN, creatinine, PCV, SDMA, and T4."
)
Generate-SpeechWav "lab_terms.wav" $labs

