const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const srcPath = path.join(projectRoot, 'src', 'unfollowers.js');
const destPath = path.join(projectRoot, 'src', 'unfollowers.min.js');
const htmlPath = path.join(projectRoot, 'docs', 'index.html');

console.log('Minifying src/unfollowers.js...');

if (!fs.existsSync(srcPath)) {
  console.error(`Error: Source file not found at ${srcPath}`);
  process.exit(1);
}

const code = fs.readFileSync(srcPath, 'utf8');

let state = 'NORMAL'; // NORMAL, STRING_SINGLE, STRING_DOUBLE, STRING_TEMPLATE, REGEX, COMMENT_LINE, COMMENT_BLOCK
let output = [];
let i = 0;

function isAlphaNumeric(char) {
  if (!char) return false;
  return /[a-zA-Z0-9_$]/.test(char);
}

function getPrevNonWhitespaceChar() {
  for (let idx = output.length - 1; idx >= 0; idx--) {
    const char = output[idx];
    if (!/\s/.test(char)) {
      return char;
    }
  }
  return '';
}

while (i < code.length) {
  const c = code[i];
  const next = code[i + 1] || '';

  if (state === 'NORMAL') {
    if (c === '/' && next === '/') {
      state = 'COMMENT_LINE';
      i += 2;
      continue;
    } else if (c === '/' && next === '*') {
      state = 'COMMENT_BLOCK';
      i += 2;
      continue;
    } else if (c === "'") {
      state = 'STRING_SINGLE';
      output.push(c);
    } else if (c === '"') {
      state = 'STRING_DOUBLE';
      output.push(c);
    } else if (c === '`') {
      state = 'STRING_TEMPLATE';
      output.push(c);
    } else if (c === '/') {
      const prev = getPrevNonWhitespaceChar();
      if (isAlphaNumeric(prev) || prev === ')' || prev === ']') {
        output.push(c);
      } else {
        state = 'REGEX';
        output.push(c);
      }
    } else if (/\s/.test(c)) {
      const prev = getPrevNonWhitespaceChar();
      let nextNonWS = '';
      let nextIdx = i + 1;
      while (nextIdx < code.length) {
        if (!/\s/.test(code[nextIdx])) {
          nextNonWS = code[nextIdx];
          break;
        }
        nextIdx++;
      }
      if (isAlphaNumeric(prev) && isAlphaNumeric(nextNonWS)) {
        output.push(' ');
      }
    } else {
      output.push(c);
    }
  } else if (state === 'STRING_SINGLE') {
    output.push(c);
    if (c === '\\') {
      output.push(next);
      i++;
    } else if (c === "'") {
      state = 'NORMAL';
    }
  } else if (state === 'STRING_DOUBLE') {
    output.push(c);
    if (c === '\\') {
      output.push(next);
      i++;
    } else if (c === '"') {
      state = 'NORMAL';
    }
  } else if (state === 'STRING_TEMPLATE') {
    output.push(c);
    if (c === '\\') {
      output.push(next);
      i++;
    } else if (c === '`') {
      state = 'NORMAL';
    }
  } else if (state === 'REGEX') {
    output.push(c);
    if (c === '\\') {
      output.push(next);
      i++;
    } else if (c === '/') {
      state = 'NORMAL';
    }
  } else if (state === 'COMMENT_LINE') {
    if (c === '\n' || c === '\r') {
      state = 'NORMAL';
    }
  } else if (state === 'COMMENT_BLOCK') {
    if (c === '*' && next === '/') {
      state = 'NORMAL';
      i += 2;
      continue;
    }
  }

  i++;
}

const minified = output.join('');
fs.writeFileSync(destPath, minified, 'utf8');
console.log(`Saved minified script to ${destPath} (Length: ${minified.length})`);

// HTML escaping helper
function escapeHTML(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

if (fs.existsSync(htmlPath)) {
  console.log('Injecting minified code into docs/index.html...');
  let html = fs.readFileSync(htmlPath, 'utf8');
  
  const startToken = '<pre class="code-box" id="codeBox">';
  const endToken = '</pre>';
  
  const startIndex = html.indexOf(startToken);
  if (startIndex === -1) {
    console.error('Error: Could not find <pre class="code-box" id="codeBox"> in index.html');
    process.exit(1);
  }
  
  const rest = html.substring(startIndex + startToken.length);
  const endIndex = rest.indexOf(endToken);
  if (endIndex === -1) {
    console.error('Error: Could not find closing </pre> tag in index.html');
    process.exit(1);
  }
  
  const escapedCode = escapeHTML(minified);
  const updatedHtml = html.substring(0, startIndex + startToken.length) + escapedCode + rest.substring(endIndex);
  
  fs.writeFileSync(htmlPath, updatedHtml, 'utf8');
  console.log('Successfully updated docs/index.html!');
} else {
  console.warn(`Warning: HTML file not found at ${htmlPath}. Skipping HTML injection.`);
}

// Clean up the temporary minified file
if (fs.existsSync(destPath)) {
  fs.unlinkSync(destPath);
  console.log(`Cleaned up temporary file: ${destPath}`);
}

