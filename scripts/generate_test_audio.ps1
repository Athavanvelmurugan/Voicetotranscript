# Script to generate dual-voice live consultation audio
Add-Type -AssemblyName System.Speech

$testAssetsDir = (Resolve-Path (Join-Path $PSScriptRoot "..\frontend\test-assets")).Path
$outputFile = Join-Path $testAssetsDir "test audio.wav"

Write-Host "Synthesizing test audio to: $outputFile" -ForegroundColor Cyan

$dialogue = @(
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "Good morning, Mark. It is great to see you and Milo. What brings you both into the clinic today?"
    },
    @{
        Speaker = "Mark"
        Voice = "Microsoft David Desktop"
        Text = "Good morning, Dr. Sarah. I'm really worried about him. Starting yesterday afternoon, Milo became super lethargic. He vomited twice after dinner, and this morning he completely refused his favorite kibble. That's just not like him at all."
    },
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "I completely understand your concern. Golden Retrievers rarely turn down a meal, so that is definitely an important clue. Has he been keeping any water down, or have you noticed any diarrhea?"
    },
    @{
        Speaker = "Mark"
        Voice = "Microsoft David Desktop"
        Text = "He drank a little bit of water about an hour ago, but he vomited clear foam shortly after. No diarrhea that I've seen, but he hasn't had a bowel movement since yesterday morning."
    },
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "Okay, good to know. Any chance he got into the trash, ate table scraps, or chewed up a toy or socks around the house recently?"
    },
    @{
        Speaker = "Mark"
        Voice = "Microsoft David Desktop"
        Text = "Well... two nights ago, my daughter left a pair of wool socks on the floor, and we could only find one of them. I'm really terrified he might have swallowed it while we were out."
    },
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "That gives us a critical piece of history. Foreign material ingestion is definitely something we need to investigate closely. Let's do a hands-on physical exam right now and see how he's feeling."
    },
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "Looking at his gums, they are slightly tacky, indicating mild dehydration, but capillary refill time is under two seconds, which is good. His heart rate is steady at ninety beats per minute, and his temperature is completely normal at one hundred and one point five degrees."
    },
    @{
        Speaker = "Mark"
        Voice = "Microsoft David Desktop"
        Text = "How does his abdomen feel, Doctor? Is he in pain?"
    },
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "On gentle abdominal palpation, his cranial abdomen feels slightly tense, and he showed some mild discomfort right around the stomach region. I don't feel a distinct hard mass, but a soft fabric foreign body wouldn't necessarily be palpable by hand."
    },
    @{
        Speaker = "Mark"
        Voice = "Microsoft David Desktop"
        Text = "What do you recommend we do next?"
    },
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "Here is our plan. First, I want to take a two-view abdominal X-ray to check for signs of gastrointestinal obstruction or unusual gas patterns. If the radiograph looks clear, we will administer an injection of Cerenia to stop the nausea and give subcutaneous fluids to rehydrate him."
    },
    @{
        Speaker = "Mark"
        Voice = "Microsoft David Desktop"
        Text = "That sounds very sensible. If the X-rays are clean, what should I feed him when we get home?"
    },
    @{
        Speaker = "Dr. Sarah"
        Voice = "Microsoft Zira Desktop"
        Text = "We'll fast him for six hours, then start a bland diet of boiled chicken and white rice in small portions. But if he vomits again or seems painful, bring him straight back for an ultrasound."
    },
    @{
        Speaker = "Mark"
        Voice = "Microsoft David Desktop"
        Text = "Thank you so much, Dr. Sarah. That gives me a lot of relief. Let's go ahead with the X-rays right away."
    }
)

$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
$synth.Rate = -1 # Natural speaking pace for clinical dictation/dialogue

# Set audio output format to 22kHz, 16-bit, Mono (standard high-compatibility speech format)
$audioFormat = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(22050, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$synth.SetOutputToWaveFile($outputFile, $audioFormat)

$builder = New-Object System.Speech.Synthesis.PromptBuilder

foreach ($turn in $dialogue) {
    Write-Host "Adding turn: $($turn.Speaker) ($($turn.Voice))" -ForegroundColor Gray
    $builder.StartVoice($turn.Voice)
    $builder.AppendText($turn.Text)
    $builder.EndVoice()
    # 700ms natural conversational pause between speakers
    $builder.AppendBreak([TimeSpan]::FromMilliseconds(700))
}

$synth.Speak($builder)
$synth.Dispose()

$fileInfo = Get-Item $outputFile
Write-Host "Successfully generated '$($fileInfo.Name)' ($([Math]::Round($fileInfo.Length / 1MB, 2)) MB)" -ForegroundColor Green
