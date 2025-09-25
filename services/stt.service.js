const speech = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');
const stream = require('stream');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS_BASE64 env variable not set.");
}

const credentials = JSON.parse(
    Buffer.from(process.env.GOOGLE_APPLICATION_CREDENTIALS_BASE64, 'base64').toString('utf-8')
);

const speechClient = new speech.SpeechClient({ credentials });

/**
 * Transcribes audio from a buffer. It uses ffmpeg for format conversion and
 * configures Google STT to recognize both Japanese and English speech.
 * @param {Buffer} audioBuffer The raw buffer from the uploaded audio file.
 * @returns {Promise<string>} A promise that resolves with the transcription text.
 */
async function transcribeAudio(audioBuffer) {
    // console.log('[DEBUG] ===== STT SERVICE - TRANSCRIBE AUDIO START =====');
    // console.log('[DEBUG] Audio buffer length:', audioBuffer.length);

    return new Promise((resolve, reject) => {

        const readable = new stream.PassThrough();
        readable.end(audioBuffer);
        const chunks = [];

        // console.log('[DEBUG] Starting ffmpeg processing...');
        ffmpeg(readable)
            .toFormat('wav')
            .audioChannels(1)
            .audioFrequency(16000)
            .on('error', (err) => {
                console.error('[DEBUG] ffmpeg error:', err.message);
                console.error('[DEBUG] ffmpeg error stack:', err.stack);
                reject(new Error('Failed to process audio file. It may be corrupted or in an unsupported format.'));
            })
            .on('start', (commandLine) => {
                // console.log('[DEBUG] ffmpeg started with command:', commandLine);
            })
            .pipe()
            .on('data', (chunk) => {
                // console.log('[DEBUG] ffmpeg chunk received, size:', chunk.length);
                chunks.push(chunk);
            })
            .on('end', async () => {
                // console.log('[DEBUG] ffmpeg processing completed');
                const convertedAudioBuffer = Buffer.concat(chunks);
                // console.log('[DEBUG] Final converted audio buffer size:', convertedAudioBuffer.length);

                const request = {
                    audio: {
                        content: convertedAudioBuffer.toString('base64'),
                    },
                    config: {
                        encoding: 'LINEAR16',
                        sampleRateHertz: 16000,

                        languageCode: 'ja-JP',

                        alternativeLanguageCodes: ['en-US'],

                        enableAutomaticPunctuation: true,
                    },
                };

                // console.log('[DEBUG] Sending request to Google Speech-to-Text API...');
                try {
                    const [response] = await speechClient.recognize(request);
                    // console.log('[DEBUG] Google STT API responded');
                    // console.log('[DEBUG] Number of results:', response.results?.length);

                    const transcription = response.results
                        .map(result => result.alternatives[0].transcript)
                        .join('\n');

                    // console.log('[DEBUG] STT Transcription result:', transcription);
                    // console.log('[DEBUG] ===== STT SERVICE - TRANSCRIBE AUDIO END =====');
                    resolve(transcription);
                } catch (error) {
                    console.error('[DEBUG] ERROR in Google Speech-to-Text:', error);
                    console.error('[DEBUG] Error stack:', error.stack);
                    // console.log('[DEBUG] ===== STT SERVICE - TRANSCRIBE AUDIO END (ERROR) =====');
                    reject(new Error('Failed to transcribe audio after processing.'));
                }
            });
    });
}

module.exports = { transcribeAudio };