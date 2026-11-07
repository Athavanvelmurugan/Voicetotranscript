Add-Type -AssemblyName System.Speech

$outDir = "C:\Users\Athavan\Desktop\Audio test"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$paragraphs = @(
    "Good morning, doctor. I brought my dog Max today because he has been having difficulty walking for the past three weeks. He is a six-year-old German Shepherd, and his weight is approximately 32 kilograms. Earlier, he used to run, jump, and play regularly, but recently he has become less active.",
    "I first noticed the problem when he started limping slightly on his back right leg. Initially, it happened only after long walks, but now he sometimes struggles to stand up after sleeping. When he gets up in the morning, he walks very slowly and appears uncomfortable. He also avoids climbing stairs and jumping onto the sofa.",
    "Yesterday, when I tried to take him for a walk, he stopped several times and preferred sitting down. I also noticed that he sometimes cries when I touch his back legs or around his hip area. His appetite is mostly normal, but he has gained around two kilograms because he is not exercising as much as before.",
    "I have not noticed any recent accident or major injury. However, he occasionally slips on the tiled floor at home. I am worried that he might have a joint or bone problem.",
    "Doctor, could you please examine Max and tell me what could be causing this difficulty? Could it be arthritis, hip dysplasia, a ligament injury, or some other orthopedic condition?",
    "I understand, doctor. You mentioned that his hip movement seems restricted and that he experiences discomfort when you extend his hind legs. Does this indicate inflammation in the joints? Could this be an early sign of osteoarthritis?",
    "What diagnostic tests would you recommend? Should we perform X-rays of both hip joints and the knee to check for joint degeneration, bone abnormalities, or hip dysplasia?",
    "Would an orthopedic examination help determine whether the problem is related to the cranial cruciate ligament? If the X-ray is not sufficient, would an ultrasound or MRI be necessary?",
    "Doctor, should we also perform blood investigations before starting long-term medication? I would like to check his Complete Blood Count, including red blood cells, white blood cells, hemoglobin, and platelets.",
    "What about his inflammatory markers? Can we evaluate C-reactive protein to understand whether there is significant inflammation? Are there any other biomarkers that can help assess his overall condition?",
    "I also want to check his kidney and liver function because he may need pain-relief medication. Should we test ALT, AST, ALP, total bilirubin, blood urea nitrogen, creatinine, and albumin?",
    "Would checking electrolytes and blood glucose also be useful as part of his general health assessment?",
    "Okay, doctor. Please proceed with the recommended tests and imaging.",
    "Now I would like to understand the treatment options. If the examination confirms osteoarthritis, what medications are generally used to manage joint pain and inflammation?",
    "Would an anti-inflammatory medication such as carprofen or meloxicam be appropriate for Max? I understand that these medicines can have side effects, especially involving the stomach, liver, or kidneys. How will we monitor him during treatment?",
    "Would he benefit from joint supplements containing glucosamine, chondroitin, or omega-3 fatty acids? Can these supplements help support joint health over time?",
    "If the condition is related to a ligament injury or severe hip dysplasia, would surgery be necessary, or can it initially be managed with medication and physiotherapy?",
    "Doctor, do you recommend physiotherapy or controlled exercise? Should I take him for short walks instead of long walks? Would swimming or hydrotherapy help improve his muscle strength without putting too much pressure on his joints?",
    "What changes should I make at home? Should I provide an orthopedic dog bed, non-slip floor mats, and a ramp to help him climb onto elevated surfaces?",
    "I also want to discuss his weight. Since he has gained two kilograms, should we reduce his food portions? Would a weight-management diet help reduce pressure on his joints?",
    "Could you please explain the dosage, frequency, duration, and possible side effects of the prescribed medication? Should I give the medicine after food, and are there any medications that I should avoid combining with it?",
    "Finally, doctor, how long will it take for Max to show improvement? Should we repeat kidney and liver function tests after starting medication? How frequently should we schedule follow-up examinations and repeat X-rays if necessary?",
    "I will follow your recommendations and make sure he gets proper rest and controlled exercise. If his pain becomes worse or he suddenly cannot stand or walk, I will bring him back immediately.",
    "Thank you so much, doctor. I hope Max can walk comfortably and return to his normal activities soon."
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
Generate-Wav "Microsoft David Desktop" "max_consultation.wav"

# 2. Female voice audio (Microsoft Zira)
Generate-Wav "Microsoft Zira Desktop" "max_consultation_female.wav"

