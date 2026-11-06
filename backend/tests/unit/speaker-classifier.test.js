const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const speakerClassifier = require('../../src/modules/transcription/speaker.classifier');

describe('Semantic Clinical Speaker Classifier Unit Tests', () => {

  it('1. should classify clinical examination and vital inquiries as DOCTOR', () => {
    const role1 = speakerClassifier.classify('Let me take a look at Bella. Her heart rate is 110 bpm and lungs sound clear.');
    assert.equal(role1, 'doctor');

    const role2 = speakerClassifier.classify('How long has she had this cough?');
    assert.equal(role2, 'doctor');
  });

  it('2. should classify prescription and dosage statements as DOCTOR', () => {
    const role = speakerClassifier.classify("I recommend we start Amoxicillin 250 mg tablets twice daily with food.");
    assert.equal(role, 'doctor');
  });

  it('3. should classify symptom onset and home observations as OWNER', () => {
    const role1 = speakerClassifier.classify('She started coughing yesterday at home after playing in the yard.');
    assert.equal(role1, 'owner');

    const role2 = speakerClassifier.classify("She hasn't been eating her kibble for three days and is very lethargic.");
    assert.equal(role2, 'owner');
  });

  it('4. should respect manual forced role overrides when specified', () => {
    const forcedDoctor = speakerClassifier.classify('She started throwing up yesterday.', 'doctor');
    assert.equal(forcedDoctor, 'doctor');

    const forcedOwner = speakerClassifier.classify('Let me examine her abdomen.', 'owner');
    assert.equal(forcedOwner, 'owner');
  });

  it('5. should safely fallback to doctor for general inquiry in auto mode', () => {
    const role = speakerClassifier.classify('Is there any other concern today?', 'auto');
    assert.equal(role, 'doctor');
  });

});

