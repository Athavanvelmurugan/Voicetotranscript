const { describe, it } = require('node:test');
const assert = require('node:assert');
const clinicalTranslator = require('../../src/modules/clinical-ai/clinical.translator');

describe('Multilingual Live Consultation Translation to English Unit Tests', () => {
  // ─── 1. Tamil Live Consultation Test ───
  it('1. should translate Tamil consultation dialogue into clinical English with true speaker diarization', async () => {
    const consultation = {
      pet_name: 'Amul',
      pet_species: 'Canine (Dog)',
      pet_breed: 'Labrador Retriever',
      doctor_name: 'Dr. Dhanush',
      owner_name: 'Ramesh',
    };

    const tamilSegments = [
      {
        text: 'வணக்கம் டாக்டர் தனுஷ். என் நாய் அமுலுக்கு கடந்த இரண்டு நாட்களாக வாந்தி மற்றும் சோர்வு இருக்கிறது. சரியாக சாப்பிடவில்லை.',
        speakerRole: 'unknown',
      },
      {
        text: 'வணக்கம் ரமேஷ். நான் அமுலை பரிசோதிக்கிறேன். உடல் வெப்பநிலை 102 டிகிரி இருக்கிறது, லேசான நீர்ச்சத்து குறைபாடு உள்ளது. வயிற்றுப் பகுதியில் வலி தெரிகிறது.',
        speakerRole: 'unknown',
      },
      {
        text: 'டாக்டர், இதற்கு Complete Blood Count (CBC) ரத்தப் பரிசோதனை செய்ய வேண்டுமா? வாந்தியைக் கட்டுப்படுத்த Maropitant ஊசி போடலாமா?',
        speakerRole: 'unknown',
      },
      {
        text: 'ஆம், CBC பரிசோதனை செய்வோம். நீர்ச்சத்து இழப்பை ஈடுசெய்ய IV Fluid Therapy மற்றும் வாந்திக்கு Maropitant மருந்து கொடுக்கிறேன்.',
        speakerRole: 'unknown',
      },
    ];

    const result = await clinicalTranslator.translateAndDiarize({
      segments: tamilSegments,
      fullText: tamilSegments.map(s => s.text).join(' '),
      consultation,
      forceLanguage: 'en',
    });

    assert.ok(result, 'Translation result must exist');
    assert.strictEqual(result.detectedLanguage, 'en', 'Detected language must be English');
    assert.strictEqual(result.segments.length, 4, 'Should retain 4 segments');

    const fullText = result.fullText.toLowerCase();
    console.log('\n[Tamil -> English Translation Output]:\n', result.fullText);

    // Verify clinical accuracy
    assert.match(fullText, /amul/i, 'Must identify pet Amul');
    assert.match(fullText, /vomit/i, 'Must capture vomiting symptom');
    assert.match(fullText, /dehydrat/i, 'Must capture dehydration');
    assert.match(fullText, /(cbc|blood count)/i, 'Must capture CBC test');
    assert.match(fullText, /maropitant/i, 'Must preserve Maropitant medication');
    assert.match(fullText, /(iv fluid|fluid therapy)/i, 'Must capture IV fluid therapy');

    // Verify true speaker diarization (owner vs doctor)
    assert.strictEqual(result.segments[0].speakerRole, 'owner', 'Segment 1 (reporting symptoms) must be owner');
    assert.strictEqual(result.segments[1].speakerRole, 'doctor', 'Segment 2 (clinical examination) must be doctor');
    assert.strictEqual(result.segments[2].speakerRole, 'owner', 'Segment 3 (asking questions) must be owner');
    assert.strictEqual(result.segments[3].speakerRole, 'doctor', 'Segment 4 (prescribing plan) must be doctor');
  });

  // ─── 2. Hindi Live Consultation Test ───
  it('2. should translate Hindi consultation dialogue into clinical English with true speaker diarization', async () => {
    const consultation = {
      pet_name: 'Sheru',
      pet_species: 'Canine (Dog)',
      pet_breed: 'German Shepherd',
      doctor_name: 'Dr. Dhanush',
      owner_name: 'Rajesh',
    };

    const hindiSegments = [
      {
        text: 'नमस्ते डॉक्टर धनुष। मेरे कुत्ते शेरू को पिछले तीन दिनों से बुखार और बहुत तेज खांसी आ रही है। वह बहुत सुस्त है और खाना नहीं खा रहा है।',
        speakerRole: 'unknown',
      },
      {
        text: 'नमस्ते राजेश जी। मैं शेरू की जांच करता हूं। तापमान 103 डिग्री है और छाती में घरघराहट है। हमें सीबीसी (CBC) और चेस्ट एक्स-रे करना चाहिए।',
        speakerRole: 'unknown',
      },
      {
        text: 'डॉक्टर साहब, क्या यह कोई गंभीर फेफड़ों का इन्फेक्शन है? क्या दवा देनी होगी?',
        speakerRole: 'unknown',
      },
      {
        text: 'चिंता मत कीजिए। मैं कफ सिरप और एंटीबायोटिक Amoxicillin लिख रहा हूं। इसे दिन में दो बार खाने के बाद दें।',
        speakerRole: 'unknown',
      },
    ];

    const result = await clinicalTranslator.translateAndDiarize({
      segments: hindiSegments,
      fullText: hindiSegments.map(s => s.text).join(' '),
      consultation,
      forceLanguage: 'en',
    });

    assert.ok(result, 'Translation result must exist');
    assert.strictEqual(result.detectedLanguage, 'en', 'Detected language must be English');
    assert.strictEqual(result.segments.length, 4, 'Should retain 4 segments');

    const fullText = result.fullText.toLowerCase();
    console.log('\n[Hindi -> English Translation Output]:\n', result.fullText);

    // Verify clinical accuracy
    assert.match(fullText, /sheru/i, 'Must identify pet Sheru');
    assert.match(fullText, /(fever|temperature)/i, 'Must capture fever');
    assert.match(fullText, /cough/i, 'Must capture cough');
    assert.match(fullText, /(cbc|blood count|x-ray|radiograph)/i, 'Must capture CBC or X-ray');
    assert.match(fullText, /amoxicillin/i, 'Must capture Amoxicillin antibiotic');

    // Verify true speaker diarization (owner vs doctor)
    assert.strictEqual(result.segments[0].speakerRole, 'owner', 'Segment 1 (reporting cough) must be owner');
    assert.strictEqual(result.segments[1].speakerRole, 'doctor', 'Segment 2 (diagnosing/examining) must be doctor');
    assert.strictEqual(result.segments[2].speakerRole, 'owner', 'Segment 3 (asking questions) must be owner');
    assert.strictEqual(result.segments[3].speakerRole, 'doctor', 'Segment 4 (prescribing Amoxicillin) must be doctor');
  });

  // ─── 3. Telugu Live Consultation Test ───
  it('3. should translate Telugu consultation dialogue into clinical English with true speaker diarization', async () => {
    const consultation = {
      pet_name: 'Bruno',
      pet_species: 'Canine (Dog)',
      pet_breed: 'Golden Retriever',
      doctor_name: 'Dr. Dhanush',
      owner_name: 'Suresh',
    };

    const teluguSegments = [
      {
        text: 'నమస్కారం డాక్టర్ ధనుష్ గారు. నా కుక్క బ్రూనో గత రెండు రోజులుగా తీవ్రమైన విరేచనాలు మరియు వాంతులతో బాధపడుతోంది. చాలా నీరసంగా ఉంది.',
        speakerRole: 'unknown',
      },
      {
        text: 'నమస్కారం సురేష్ గారు. నేను బ్రూనోను పరీక్షిస్తాను. కడుపు ఉబ్బరంగా ఉంది మరియు తీవ్రమైన డీహైడ్రేషన్ ఉంది. ఇన్ఫెక్షన్ స్థాయి కోసం CBC టెస్ట్ చేద్దాం.',
        speakerRole: 'unknown',
      },
      {
        text: 'డాక్టర్ గారు, డీహైడ్రేషన్ తగ్గించడానికి సెలైన్ పెట్టాలా? వాంతులు ఆగడానికి ఇంజెక్షన్ ఇస్తారా?',
        speakerRole: 'unknown',
      },
      {
        text: 'అవును, మేము IV Fluid Therapy ఇస్తున్నాము మరియు వాంతులను నియంత్రించడానికి Maropitant ఇంజెక్షన్ ఇస్తున్నాము. తేలికపాటి ఆహారం మాత్రమే ఇవ్వండి.',
        speakerRole: 'unknown',
      },
    ];

    const result = await clinicalTranslator.translateAndDiarize({
      segments: teluguSegments,
      fullText: teluguSegments.map(s => s.text).join(' '),
      consultation,
      forceLanguage: 'en',
    });

    assert.ok(result, 'Translation result must exist');
    assert.strictEqual(result.detectedLanguage, 'en', 'Detected language must be English');
    assert.strictEqual(result.segments.length, 4, 'Should retain 4 segments');

    const fullText = result.fullText.toLowerCase();
    console.log('\n[Telugu -> English Translation Output]:\n', result.fullText);

    // Verify clinical accuracy
    assert.match(fullText, /bruno/i, 'Must identify pet Bruno');
    assert.match(fullText, /vomit/i, 'Must capture vomiting');
    assert.match(fullText, /diarrhea/i, 'Must capture diarrhea');
    assert.match(fullText, /dehydrat/i, 'Must capture dehydration');
    assert.match(fullText, /(iv fluid|fluid therapy)/i, 'Must capture IV fluid therapy');
    assert.match(fullText, /maropitant/i, 'Must capture Maropitant');

    // Verify true speaker diarization (owner vs doctor)
    assert.strictEqual(result.segments[0].speakerRole, 'owner', 'Segment 1 (reporting diarrhea) must be owner');
    assert.strictEqual(result.segments[1].speakerRole, 'doctor', 'Segment 2 (examining) must be doctor');
    assert.strictEqual(result.segments[2].speakerRole, 'owner', 'Segment 3 (asking questions) must be owner');
    assert.strictEqual(result.segments[3].speakerRole, 'doctor', 'Segment 4 (treatment plan) must be doctor');
  });
});

