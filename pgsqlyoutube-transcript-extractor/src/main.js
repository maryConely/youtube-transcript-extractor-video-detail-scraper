onst Apify = require('apify');
const fs = require('fs');
const path = require('path');
const { extractVideoData } = require('./utils/videoParser');
const { fetchTranscript } = require('./utils/transcript');

async function loadLocalInput() {
try {
const localPath = path.join(__dirname, '..', 'examples', 'input.json');
const raw = fs.readFileSync(localPath, 'utf8');
return JSON.parse(raw);
} catch (err) {
console.error('Failed to load local input.json:', err.message);
return null;
}
}

Apify.main(async () => {
let input = null;

try {
input = await Apify.getInput();
} catch (err) {
console.error('Error reading Apify input, falling back to local input.json:', err.message);
}

if (!input) {
console.log('No Apify input found, attempting to use examples/input.json...');
input = await loadLocalInput();
}

if (!input) {
throw new Error(
'No valid input provided. Supply Apify INPUT or create examples/input.json.'
);
}

const {
startUrls = [],
includeTranscript = true,
language = 'en',
maxConcurrency,
minConcurrency,
maxRequestRetries = 3
} = input;

if (!Array.isArray(startUrls) || startUrls.length === 0) {
throw new Error('"startUrls" must be a non-empty array in the input.');
}

console.log(`Starting crawl for ${startUrls.length} URL(s)...`);

const requestList = await Apify.openRequestList('start-urls', startUrls);

const results = [];

const crawlerOptions = {
requestList,
maxRequestRetries,
handleRequestFunction: async ({ request }) => {
console.log(`Processing: ${request.url}`);
try {
const videoData = await extractVideoData(request.url);

if (includeTranscript) {
const transcript = await fetchTranscript(videoData.videoId, language);
videoData.transcript = transcript;
videoData.transcript_only_text = transcript.map(t => t.text).join(' ');
}

results.push(videoData);
console.log(`Successfully processed video: ${videoData.videoId}`);
} catch (err) {
console.error(`Failed to process ${request.url}:`, err.message);
results.push({
url: request.url,
error: err.message
});
}
}
};

if (typeof maxConcurrency === 'number') {
crawlerOptions.maxConcurrency = maxConcurrency;
}
if (typeof minConcurrency === 'number') {
crawlerOptions.minConcurrency = minConcurrency;
}

const crawler = new Apify.BasicCrawler(crawlerOptions);

await crawler.run();

console.log(`Crawl finished. Processed ${results.length} item(s).`);

await Apify.pushData(results);

if (!Apify.isAtHome()) {
const outputPath = path.join(__dirname, '..', 'examples', 'output-local.json');
try {
fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
console.log(`Results also saved locally to: ${outputPath}`);
} catch (err) {
console.error('Failed to write local output file:', err.message);
}
}
});