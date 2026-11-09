const yt = require('@vreden/youtube_scraper');
const yts = require('yt-search');
const axios = require('axios');

/**
 * Clean user query: remove prefix and command name
 */
function cleanQuery(text) {
    if (!text) return '';
    return text.trim()
        .replace(/^\.(?:play|song|mp3|ytmp3|music|video|ytmp4)\s*/i, '')
        .trim();
}

/**
 * Search YouTube
 */
async function searchYouTube(query) {
    const q = cleanQuery(query);
    if (!q) throw new Error('Query is empty');

    // Check if query is already a direct YouTube URL
    const isUrl = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})/i.test(q);
    if (isUrl) {
        return [{
            url: q,
            title: 'YouTube Media',
            thumbnail: '',
            duration: ''
        }];
    }

    try {
        const searchResult = await yts(q);
        if (searchResult && searchResult.videos && searchResult.videos.length > 0) {
            return searchResult.videos.map(v => ({
                url: v.url,
                title: v.title,
                thumbnail: v.thumbnail || v.image,
                duration: v.timestamp || '',
                seconds: v.seconds,
                author: v.author?.name || ''
            }));
        }
    } catch (e) {
        console.warn('[YouTube Search] yt-search fallback:', e.message);
    }

    // Secondary fallback: @vreden/youtube_scraper.search
    try {
        const vResult = await yt.search(q);
        if (Array.isArray(vResult) && vResult.length > 0) {
            return vResult.map(v => ({
                url: v.url,
                title: v.title,
                thumbnail: v.thumbnail || v.image,
                duration: v.timestamp || (v.duration?.timestamp) || '',
                seconds: v.seconds || (v.duration?.seconds),
                author: v.author?.name || ''
            }));
        }
    } catch (e) {
        console.warn('[YouTube Search] vreden search fallback:', e.message);
    }

    throw new Error('No search results found');
}

/**
 * Download Audio (MP3) from YouTube
 */
async function getYtAudio(queryOrUrl) {
    const q = cleanQuery(queryOrUrl);
    if (!q) throw new Error('Please provide a song name or YouTube link.');

    let targetUrl = q;
    let meta = {
        title: q,
        thumbnail: '',
        duration: '',
        author: ''
    };

    const isDirectLink = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(q);
    if (!isDirectLink) {
        const results = await searchYouTube(q);
        if (!results || results.length === 0) throw new Error('No songs found on YouTube.');
        targetUrl = results[0].url;
        meta.title = results[0].title;
        meta.thumbnail = results[0].thumbnail;
        meta.duration = results[0].duration;
        meta.author = results[0].author;
    }

    // Fetch MP3 from vreden youtube_scraper (128kbps)
    const res = await yt.ytmp3(targetUrl, 128);
    if (!res || !res.status || !res.download?.url) {
        throw new Error('Could not fetch audio download stream.');
    }

    meta.title = res.metadata?.title || meta.title;
    meta.thumbnail = res.metadata?.thumbnail || res.metadata?.image || meta.thumbnail;
    meta.duration = res.metadata?.timestamp || meta.duration;
    meta.author = res.metadata?.author?.name || meta.author;

    // Download audio buffer (with 60s timeout)
    const dlResponse = await axios.get(res.download.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
        }
    });

    const buffer = Buffer.from(dlResponse.data);
    if (!buffer || buffer.length === 0) {
        throw new Error('Downloaded audio buffer is empty.');
    }

    return {
        buffer,
        title: meta.title,
        duration: meta.duration,
        thumbnail: meta.thumbnail,
        author: meta.author,
        url: targetUrl,
        filename: (res.download.filename || `${meta.title}.mp3`).replace(/[\\/:"*?<>|]/g, '')
    };
}

/**
 * Download Video (MP4) from YouTube
 */
async function getYtVideo(queryOrUrl) {
    const q = cleanQuery(queryOrUrl);
    if (!q) throw new Error('Please provide a video title or YouTube link.');

    let targetUrl = q;
    let meta = {
        title: q,
        thumbnail: '',
        duration: '',
        author: ''
    };

    const isDirectLink = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(q);
    if (!isDirectLink) {
        const results = await searchYouTube(q);
        if (!results || results.length === 0) throw new Error('No videos found on YouTube.');
        targetUrl = results[0].url;
        meta.title = results[0].title;
        meta.thumbnail = results[0].thumbnail;
        meta.duration = results[0].duration;
        meta.author = results[0].author;
    }

    // Fetch MP4 from vreden youtube_scraper (360p)
    const res = await yt.ytmp4(targetUrl, 360);
    if (!res || !res.status || !res.download?.url) {
        throw new Error('Could not fetch video download stream.');
    }

    meta.title = res.metadata?.title || meta.title;
    meta.thumbnail = res.metadata?.thumbnail || res.metadata?.image || meta.thumbnail;
    meta.duration = res.metadata?.timestamp || meta.duration;
    meta.author = res.metadata?.author?.name || meta.author;

    // Download video buffer (with 90s timeout and browser headers)
    const dlResponse = await axios.get(res.download.url, {
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': '*/*'
        }
    });

    const buffer = Buffer.from(dlResponse.data);
    if (!buffer || buffer.length === 0) {
        throw new Error('Downloaded video buffer is empty.');
    }

    return {
        buffer,
        downloadUrl: res.download.url,
        title: meta.title,
        duration: meta.duration,
        thumbnail: meta.thumbnail,
        author: meta.author,
        url: targetUrl,
        filename: (res.download.filename || `${meta.title}.mp4`).replace(/[\\/:"*?<>|]/g, '')
    };
}

module.exports = {
    cleanQuery,
    searchYouTube,
    getYtAudio,
    getYtVideo
};
