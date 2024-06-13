const express = require('express');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.raw({ type: 'application/octet-stream', limit: '10mb' }));
app.use(express.static('public'));

// Path to your Chrome executable
const CHROME_PATH = 'C:\\Program Files \\Google\\Chrome\\Application\\chrome.exe';  // Update this path if necessary

// Path to your Chrome user data directory
const USER_DATA_DIR = 'C:\\Users\\bikra\\AppData\\Local\\Google\\Chrome\\User Data';  // Update this path if necessary

app.post('/start-bot', async (req, res) => {
    const { meetingLink, email, password } = req.body;
    try {
        await runBot(meetingLink, email, password);
        res.json({ message: 'Bot started successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Failed to start bot', error: error.message });
    }
});

async function runBot(meetingLink, email, password) {
    const browser = await puppeteer.launch({
        headless: false,
        executablePath: CHROME_PATH,
        userDataDir: USER_DATA_DIR,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-infobars',
            '--window-position=0,0',
            '--ignore-certifcate-errors',
            '--ignore-certifcate-errors-spki-list',
            '--user-agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"'
        ]
    });
    const page = await browser.newPage();

    // Navigate to the Google Meet link
    await page.goto(meetingLink);
    await page.waitForSelector('button[aria-label="Turn off microphone"]', { visible: true });
    await page.click('button[aria-label="Turn off microphone"]');

    // Monitor for mute/unmute events
    const checkMutedStatus = async () => {
        const isMuted = await page.evaluate(() => {
            const micButton = document.querySelector('button[aria-label*="Turn off microphone"]') || document.querySelector('button[aria-label*="Turn on microphone"]');
            return micButton && micButton.getAttribute('aria-label').includes('Turn on microphone');
        });
        return isMuted;
    };

    const handleMuted = async () => {
        await page.evaluate(() => {
            // Trigger the recording function from the browser context
            recordAudio();
        });

        // Wait for the audio to be processed and played back (adjust the timing as needed)
        await new Promise(resolve => setTimeout(resolve, 10000));  // Wait for 10 seconds

        // Unmute
        await page.click('button[aria-label="Turn on microphone"]');
    };

    // Polling to check if the bot is muted by the host
    setInterval(async () => {
        if (await checkMutedStatus()) {
            await handleMuted();
        }
    }, 5000);  // Check every 5 seconds
}

app.post('/process-audio', async (req, res) => {
    const audioBuffer = req.body;

    // Save the received audio data to a file
    fs.writeFileSync('received_audio.wav', audioBuffer);

    // Send the audio data to a remote server for processing
    const response = await axios.post('https://your-remote-server.com/process-audio', audioBuffer, {
        headers: { 'Content-Type': 'application/octet-stream' },
        responseType: 'arraybuffer'
    });

    const processedAudioBuffer = response.data;

    // Send back the processed audio data to the client
    res.send(Buffer.from(processedAudioBuffer));
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
