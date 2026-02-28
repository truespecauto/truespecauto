// Automatically use localhost when testing locally, and your deployed backend URL in production.
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:7860' 
    : 'https://truespecadmin-truespec.hf.space'; // <--- UPDATE THIS BEFORE LAUNCH
