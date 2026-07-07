const fs = require('fs');
const html = fs.readFileSync('C:\\Users\\New User\\.gemini\\antigravity\\brain\\58c888ed-3089-4215-bf7a-eab582739f21\\.system_generated\\steps\\437\\content.md', 'utf8');
const matches = html.match(/https?:\/\/[^\s"'\\<>]*/gi);
const urls = Array.from(new Set(matches));
urls.filter(u => u.toLowerCase().includes('gateway') || u.toLowerCase().includes('zama')).forEach(u => console.log(u));
