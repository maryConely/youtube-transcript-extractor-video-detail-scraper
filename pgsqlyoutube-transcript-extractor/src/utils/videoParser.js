onst fetch = require('node-fetch');

/**
* Extracts a YouTube video ID from multiple URL formats:
* - https://www.youtube.com/watch?v=ID
* - https://youtu.be/ID
* - https://www.youtube.com/shorts/ID
* - https://www.youtube.com/embed/ID
*/
function extractId(url) {
if (!url || typeof url !== 'string') {
throw new Error('extractId: url must be a non-empty string');
}

const watchMatch = url.match(/[?&]v=([^&]+)/);
if (watchMatch && watchMatch[1]) {
return watchMatch[1];
}

const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/);
if (shortMatch && shortMatch[1]) {
return shortMatch[1];
}

const shortsMatch = url.match(/\/shorts\/([a-zA-Z0-9_-]{6,})/);
if (shortsMatch && shortsMatch[1]) {
return shortsMatch[1];
}

const embedMatch = url.match(/\/embed\/([a-zA-Z0-9_-]{6,})/);
if (embedMatch && embedMatch[1]) {
return embedMatch[1];
}

throw new Error(`Unable to extract video ID from URL: ${url}`);
}

/**
* Extracts the ytInitialPlayerResponse JSON from the YouTube HTML.
*/
function parsePlayerResponse(html) {
const marker = 'ytInitialPlayerResponse = ';

const startIndex = html.indexOf(marker);
if (startIndex === -1) {
throw new Error('Could not locate ytInitialPlayerResponse in HTML.');
}

const jsonStart = startIndex + marker.length;
let jsonEnd = html.indexOf(';</script>', jsonStart);
if (jsonEnd === -1) {
// Fallback: find the first closing brace followed by semicolon after the start.
jsonEnd = html.indexOf('};', jsonStart);
if (jsonEnd === -1) {
throw new Error('Could not determine end of ytInitialPlayerResponse JSON.');
}
jsonEnd += 1; // include closing brace
}

const jsonText = html.slice(jsonStart, jsonEnd).trim();

try {
return JSON.parse(jsonText);
} catch (err) {
throw new Error(`Failed to parse player response JSON: ${err.message}`);
}
}

/**
* Fetches a YouTube watch page and extracts structured video data.
*/
async function extractVideoData(url) {
const videoId = extractId(url);
const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;

let response;
try {
response = await fetch(watchUrl, {
headers: {
'accept-language': 'en-US,en;q=0.9',
'user-agent':
'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
'(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
}
});
} catch (err) {
throw new Error(`Network error while fetching YouTube page: ${err.message}`);
}

if (!response.ok) {
throw new Error(
`Failed to fetch YouTube page (status ${response.status}) for videoId=${videoId}`
);
}

const html = await response.text();

const playerResponse = parsePlayerResponse(html);
const details = playerResponse.videoDetails || {};
const microformat = playerResponse.microformat
? playerResponse.microformat.playerMicroformatRenderer || {}
: {};

const viewCount = details.viewCount ? Number(details.viewCount) : null;
const durationSeconds = details.lengthSeconds ? Number(details.lengthSeconds) : null;

return {
videoId,
url: watchUrl,
title: details.title || null,
description: details.shortDescription || null,
author: details.author || null,
channelId: details.channelId || null,
keywords: details.keywords || [],
viewCount,
isPrivate: typeof details.isPrivate === 'boolean' ? details.isPrivate : null,
isLiveContent:
typeof details.isLiveContent === 'boolean' ? details.isLiveContent : null,
thumbnails: (details.thumbnail && details.thumbnail.thumbnails) || [],
durationSeconds,
publishDate: microformat.publishDate || null,
uploadDate: microformat.uploadDate || null,
category: microformat.category || null,
tags: microformat.tags || [],
isFamilySafe:
typeof microformat.isFamilySafe === 'boolean' ? microformat.isFamilySafe : null
};
}

module.exports = {
extractVideoData,
extractId
};