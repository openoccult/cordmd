const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { join } = require('path')

GlobalFonts.registerFromPath(join(__dirname, '..', 'fonts', 'AppleColorEmoji@2x.ttf'), 'Apple Emoji');

/**
 * @function validateMarkdown // Validates the markdown text string.
 * @param {String} input // The markdown text string to validate.
 * @returns {String} // The validated markdown text string.
 */
function validateMarkdown(input) {
    if (typeof input !== 'string') {
        throw new Error('Input must be a string.');
    }
    if (input.length > 6000) {
        throw new Error('Input exceeds the maximum length of 6000 characters.');
    }
    
    const corrections = [
        { pattern: /\*\*__([^*]+)__\*\*/g, replacement: '__**$1**__' }, // Bold + Underline
        { pattern: /__\*\*([^*]+)\*\*__/g, replacement: '**__$1__**' }, // Underline + Bold
        { pattern: /__([^_]+)__/g, replacement: '__$1__' }, // Underline
        { pattern: /\*\*([^*]+)\*\*/g, replacement: '**$1**' }, // Bold
        { pattern: /\*([^*]+)\*/g, replacement: '*$1*' }, // Italic
        { pattern: /~~([^~]+)~~/g, replacement: '~~$1~~' }, // Strikethrough
        { pattern: /`([^`]+)`/g, replacement: '`$1`' }, // Inline Code
    ];
    
    let result = input;
    corrections.forEach(({ pattern, replacement }) => {
        result = result.replace(pattern, replacement);
    });

    return result;
}

// Emoji detection
function isEmoji(char) {
    const emojiRegex = /\p{Emoji}/u;
    return emojiRegex.test(char) && !/\d/.test(char);
}

/**
 * @function renderMarkdown // Renders the markdown text to an image buffer.
 * @param {String} markdown // The markdown text string to render.
 * @returns {Buffer} // The image buffer of the rendered markdown.
 */
async function renderMarkdown(markdown) {
    const validatedMarkdown = validateMarkdown(markdown);

    const canvasWidth = 800;
    const canvasHeight = 600;
    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2B2D31';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'top';

    const lines = validatedMarkdown.split('\n');
    let y = 0;

    for (let line of lines) {
        line = line.trim();
        let x = 20;


        if (/^#{1,6}\s/.test(line)) {
            // Headings
            const level = line.match(/^#{1,6}/)[0].length;
            const text = line.replace(/^#{1,6}\s/, '');
            const fontSize = 32 - level * 4;
            ctx.font = `bold ${fontSize}}px sans-serif`;

            let xOffset = x;
            for (const char of text) {
                if (isEmoji(char)) {
                    ctx.font = `bold ${fontSize}px "Apple Emoji", sans-serif`;
                } else {
                    ctx.font = `bold ${fontSize}px sans-serif`;
                }
                ctx.fillText(char, xOffset, y);
                xOffset += ctx.measureText(char).width;
            }
        
            const lineY = y + fontSize + 2;
            ctx.strokeStyle = '#44475A';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, lineY);
            ctx.lineTo(canvasWidth - 20, lineY);
            ctx.stroke();
            
            y += fontSize + 15;
        } else if (/^>/.test(line)) {
            // Blockquote
            ctx.fillStyle = '#BBBBBB90';
            ctx.font = '16px sans-serif';
            ctx.fillText('| ' + line.replace(/^>\s*/, ''), x, y);
            ctx.fillStyle = '#FFFFFF';
            y += 24;
        } else if (/^-{3,}/.test(line)) {
            // Horizontal rule
            ctx.strokeStyle = '#44475A';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(x, y + 10);
            ctx.lineTo(canvasWidth - 20, y + 10);
            ctx.stroke();
            y += 30;
        } else if (/^- /.test(line) || /^\d+\./.test(line)) {
            // Lists
            const listPrefix = line.match(/^- |^\d+\./)[0];
            const indentation = 20;
            x += indentation;

            ctx.font = '16px sans-serif';
            ctx.fillText('•', x, y);
            x += ctx.measureText(listPrefix).width;

            const listContent = line.replace(/^- |^\d+\./, '');
            renderInlineMarkdown(ctx, listContent, x, y);
            y += 24;
        } else {
            renderInlineMarkdown(ctx, line, x, y);


            let match;
            const regex = /(\*\*__([^*]+)__\*\*|__\*\*([^*]+)\*\*__|__([^_]+)__|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`)/g;
            let lastIndex = 0;

            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    const normalText = line.slice(lastIndex, match.index);
                    renderText(ctx, normalText, x, y);
                    x += ctx.measureText(normalText).width;
                }

                if (match[2] || match[3]) { // Bold + Underline
                    const text = match[2] || match[3];
                    ctx.font = 'bold 16px sans-serif';
                    ctx.fillText(text, x, y);
                    const textWidth = ctx.measureText(text).width;
                    ctx.beginPath();
                    ctx.moveTo(x, y + 18); // Underline position
                    ctx.lineTo(x + textWidth, y + 18);
                    ctx.stroke();
                    x += textWidth;
                } else if (match[4]) { // Underline
                    const text = match[4];
                    ctx.font = '16px sans-serif';
                    ctx.fillText(text, x, y);
                    const textWidth = ctx.measureText(text).width;
                    ctx.beginPath();
                    ctx.moveTo(x, y + 18); // Underline position
                    ctx.lineTo(x + textWidth, y + 18);
                    ctx.stroke();
                    x += textWidth;
                } else if (match[5]) { // Bold
                    const text = match[5];
                    ctx.font = 'bold 16px sans-serif';
                    ctx.fillText(text, x, y);
                    x += ctx.measureText(text).width;
                } else if (match[6]) { // Italic
                    const text = match[6];
                    ctx.font = 'italic 16px sans-serif';
                    ctx.fillText(text, x, y);
                    x += ctx.measureText(text).width;
                } else if (match[7]) { // Strikethrough
                    const text = match[7];
                    ctx.font = '16px sans-serif';
                    ctx.fillText(text, x, y);
                    const textWidth = ctx.measureText(text).width;
                    ctx.beginPath();
                    ctx.moveTo(x, y + 8); // Strikethrough position
                    ctx.lineTo(x + textWidth, y + 8);
                    ctx.stroke();
                    x += textWidth;
                } else if (match[8]) { // Inline code
                    const text = match[8];
                    ctx.fillStyle = '#1E1F22';
                    ctx.fillRect(x, y, ctx.measureText(text).width + 10, 20);
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '16px monospace';
                    ctx.fillText(text, x + 5, y);
                    x += ctx.measureText(text).width + 10;
                    ctx.fillStyle = '#FFFFFF';
                }

                lastIndex = regex.lastIndex;
            }

            if (lastIndex < line.length) {
                const remainingText = line.slice(lastIndex);
                renderText(ctx, remainingText, x, y);
            }

            y += 24; 
        }
    }

    const buffer = canvas.toBuffer('image/png');
    return buffer;
}

function renderInlineMarkdown(ctx, text, x, y) {
    const regex = /(\*\*__([^*]+)__\*\*|__\*\*([^*]+)\*\*__|__([^_]+)__|\*\*([^*]+)\*\*|\*([^*]+)\*|~~([^~]+)~~|`([^`]+)`)/g;
    let match;
    let lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const normalText = text.slice(lastIndex, match.index);
            renderText(ctx, normalText, x, y);
            x += ctx.measureText(normalText).width;
        }

        if (match[2] || match[3]) { // Bold + Underline
            const markdownText = match[2] || match[3];
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(markdownText, x, y);
            const width = ctx.measureText(markdownText).width;
            ctx.beginPath();
            ctx.moveTo(x, y + 18);
            ctx.lineTo(x + width, y + 18);
            ctx.stroke();
            x += width;
        } else if (match[4]) { // Underline
            const markdownText = match[4];
            ctx.font = '16px sans-serif';
            ctx.fillText(markdownText, x, y);
            const width = ctx.measureText(markdownText).width;
            ctx.beginPath();
            ctx.moveTo(x, y + 18);
            ctx.lineTo(x + width, y + 18);
            ctx.stroke();
            x += width;
        } else if (match[5]) { // Bold
            const markdownText = match[5];
            ctx.font = 'bold 16px sans-serif';
            ctx.fillText(markdownText, x, y);
            x += ctx.measureText(markdownText).width;
        } else if (match[6]) { // Italic
            const markdownText = match[6];
            ctx.font = 'italic 16px sans-serif';
            ctx.fillText(markdownText, x, y);
            x += ctx.measureText(markdownText).width;
        } else if (match[7]) { // Strikethrough
            const markdownText = match[7];
            ctx.font = '16px sans-serif';
            ctx.fillText(markdownText, x, y);
            const width = ctx.measureText(markdownText).width;
            ctx.beginPath();
            ctx.moveTo(x, y + 8);
            ctx.lineTo(x + width, y + 8);
            ctx.stroke();
            x += width;
        } else if (match[8]) { // Inline Code
            const markdownText = match[8];
            ctx.fillStyle = '#353535';
            ctx.fillRect(x, y, ctx.measureText(markdownText).width + 10, 20);
            ctx.fillStyle = '#D1B57B';
            ctx.font = '16px monospace';
            ctx.fillText(markdownText, x + 5, y);
            x += ctx.measureText(markdownText).width + 10;
            ctx.fillStyle = '#FFFFFF';
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
        const remainingText = text.slice(lastIndex);
        renderText(ctx, remainingText, x, y);
    }
}

function renderText(ctx, text, x, y, fontStyle = 'normal', underline = false) {
    for (const char of [...text]) {
        if (isEmoji(char)) {
            ctx.font = '16px "Apple Emoji", sans-serif';
        } else {
            ctx.font = `${fontStyle} 16px sans-serif`;
        }

        ctx.fillText(char, x, y);
        const charWidth = ctx.measureText(char).width;

        if (underline) {
            ctx.beginPath();
            ctx.moveTo(x, y + 18);
            ctx.lineTo(x + charWidth, y + 18);
            ctx.stroke();
        }

        x += charWidth;
    }
}

module.exports = {
    validateMarkdown,
    renderMarkdown
};