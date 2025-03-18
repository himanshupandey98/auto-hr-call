require('dotenv').config();
const express = require('express');
const twilio = require('twilio');
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const twilioClient = new twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Start AI Call to Candidate
app.post('/start-call', async (req, res) => {
    const { candidateNumber } = req.body;

    try {
        const call = await twilioClient.calls.create({
            url: 'https://auto-hr-call.onrender.com/voice-response',
            to: candidateNumber,
            from: process.env.TWILIO_PHONE_NUMBER
        });

        res.json({ success: true, callSid: call.sid });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Call failed' });
    }
});

// AI Voice Response (Twilio TTS + OpenAI STT)
app.post('/voice-response', (req, res) => {
    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say("Hello! This is an automated HR screening call. Let's begin.");
    console.log("Hello! This is an automated HR screening call. Let's begin.");

    const gather = twiml.gather({
        input: 'speech',
        timeout: 5,
        action: '/process-response'
    });

    gather.say("First question: Why do you want this job? Please speak after the beep.");
    
    res.type('text/xml');
    res.send(twiml.toString());
});


// Process Candidate Response with OpenAI Whisper
app.post('/process-response', async (req, res) => {
    const speechResult = req.body.SpeechResult;
    
    console.log('Candidate Response:', speechResult);

    // AI Analysis (ChatGPT for feedback)
    const aiFeedback = await analyzeResponseWithAI(speechResult);

    res.send(`<Response><Say>Your response has been recorded. Thank you!</Say></Response>`);
});

// AI Analysis using OpenAI GPT
async function analyzeResponseWithAI(candidateResponse) {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
            model: "gpt-4",
            messages: [
                { role: "system", content: "You are an AI HR interviewer analyzing candidate answers." },
                { role: "user", content: `Analyze this response and give a professional HR feedback: ${candidateResponse}` }
            ]
        },
        {
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`,
                'Content-Type': 'application/json'
            }
        }
    );

    return response.data.choices[0].message.content;
}

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
