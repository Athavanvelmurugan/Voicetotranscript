Add-Type -AssemblyName System.Speech

$outDir = "C:\Users\Athavan\Desktop\Audio test"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$paragraphs = @(
    "Good morning, doctor. I brought my dog Ashwin today because he has not been feeling well for the past three days. He is a three-year-old Labrador, and his weight is approximately 18 kilograms. Normally, he is very active, playful, and eats his food regularly. However, for the last three days, he has been vomiting frequently and has completely lost interest in food.",
    "Initially, I thought it was a minor stomach problem, but yesterday he vomited around four times. The vomit was mostly yellowish liquid, sometimes with a little foam. He is also drinking less water than usual. I noticed that he had loose stools twice yesterday, and today morning his stool was also watery. He seems very tired and spends most of his time lying down.",
    "One more thing I noticed is that he ate some leftover chicken from our dinner three days ago. I am not sure whether the food was fresh. Since then, his health seems to have become worse. He has not received any new medication recently. His routine vaccinations are up to date, and his last deworming was approximately three months ago.",
    "Doctor, could you please examine Ashwin and tell me what might be causing these symptoms? I am particularly worried because he is not eating and is becoming weaker.",
    "I understand, doctor. You mentioned that his temperature is slightly elevated and that he may be dehydrated. Is this possibly gastroenteritis, a bacterial infection, or food poisoning? Could there also be a problem with his liver or kidneys?",
    "If we need to investigate further, I would like to understand which laboratory tests are necessary. Should we perform a Complete Blood Count to check his white blood cells, red blood cells, hemoglobin, and platelet count? Will this help identify infection or inflammation?",
    "What about the biochemical tests? I heard that kidney and liver function can be evaluated through blood biomarkers. Should we check ALT, AST, ALP, total bilirubin, blood urea nitrogen, creatinine, and albumin?",
    "I would also like to know whether electrolytes such as sodium, potassium, and chloride should be checked because he has been vomiting and experiencing diarrhea. Could dehydration affect these values?",
    "Should we also perform a blood glucose test to check his sugar level? And is a C-reactive protein test useful for evaluating inflammation in his body?",
    "If the blood reports are not sufficient, do you recommend a stool examination or abdominal ultrasound? I want to make sure we do not miss any serious underlying condition, especially an intestinal obstruction or another abdominal problem.",
    "Okay, doctor. Please proceed with the recommended investigations.",
    "Now that the preliminary examination is complete, could you explain the treatment plan? Since Ashwin is dehydrated, will he require intravenous fluid therapy? What type of fluids would be appropriate based on his electrolyte levels and hydration status?",
    "What medication would you recommend for controlling his vomiting? Is an antiemetic such as Maropitant appropriate in his case? Would he also need any medication to protect his stomach?",
    "Should we give him probiotics to support his digestive system? And if there is evidence of a bacterial infection, would antibiotics be necessary, or should we wait for the test results before deciding?",
    "Doctor, could you please explain the medication dosage, frequency, duration, and whether each medicine should be given before or after food? I want to make sure I administer everything correctly.",
    "Also, what kind of diet should I provide once his vomiting is controlled? Can I give him a veterinary gastrointestinal diet in small portions? How much water should he drink during recovery?",
    "One final question, doctor. How long will it normally take for him to recover? Should we repeat the CBC, kidney function, liver function, and electrolyte tests after a few days to monitor his improvement?",
    "I will follow all the instructions and bring him back for the recommended follow-up examination. Please let me know immediately if any of the laboratory results indicate something serious.",
    "Thank you so much, doctor. I hope Ashwin recovers quickly."
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
Generate-Wav "Microsoft David Desktop" "ashwin_consultation.wav"

# 2. Female voice audio (Microsoft Zira)
Generate-Wav "Microsoft Zira Desktop" "ashwin_consultation_female.wav"

