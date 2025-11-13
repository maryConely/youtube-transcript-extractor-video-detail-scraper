onst fetch = require('node-fetch');

/**
* Basic HTML entity decoding for YouTube timedtext XML.
*/
function decodeHtmlEntities(str) {
if (!str) return '';
return str
.replace(/&amp;/g, '&')
.replace(/&lt;/g, '<')
.replace(/&gt;/g, '>')
.replace(/&quot;/g, '"')
.replace(/&#39;/g, "'")
.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

/**
* Format seconds into mm:ss or hh:mm:ss.
*/
function formatTime(seconds) {
const total = Math.floor(seconds);
const h = Math.floor(total / 3600);
const m = Math.floor((total % 3600) / 60);
const s = total % 60;

const pad = n => (n < 10 ? `0${n}` : `${n}`);

if (h > 0) {
return `${h}:${pad(m)}:${pad(s)}`;
}
return `${m}:${pad(s)}`;
}

/**
* Fetch timestamped transcript items for a given YouTube video and language.
* Returns an array of:
* { text, startMs, endMs, startTimeText }
*/
async function fetchTranscript(videoId, lang = 'en') {
if (!videoId) {
throw new Error('fetchTranscript: videoId is required');
}

const url = `https://www.youtube.com/api/timedtext?lang=${encodeURIComponent(
lang
)}&v=${encodeURIComponent(videoId)}`;

try {
const response = await fetch(url);

if (!response.ok) {
console.error(
`Transcript request failed (status ${response.status}) for videoId=${videoId}`
);
return [];
}

const xml = await response.text();

const matches = [...xml.matchAll(/<text start="(.*?)" dur="(.*?)">(.*?)<\/text>/g)];

return matches.map(match => {
const [, start, dur, rawContent] = match;
const startSec = parseFloat(start) || 0;
const durSec = parseFloat(dur) || 0;
const text = decodeHtmlEntities(rawContent.replace(/\n+/g, ' '));

return {
text,
startMs: Math.round(startSec * 1000),
endMs: Math.round((startSec + durSec) * 1000),
startTimeText: formatTime(startSec)
};
});
} catch (err) {
console.error('Error while fetching or parsing transcript:', err.message);
return [];
}
}

module.exports = {
fetchTranscript
};