// One self-contained HTML mock from an App.jsx source, through Open CoDesign's own HTML export, made to run under a
// page policy that allows no eval and no network (sign-off's mock frame is one): the export compiles JSX in the page
// with Babel and `new Function`, so here each compile block is compiled now, with that same vendored Babel, and the
// in-page Babel and the remote font links are dropped. The page's own policy then blocks every fetch at view time.
import { buildHtmlDocument } from '@open-codesign/exporters/html';
import BABEL from '../vendor/open-codesign/runtime/vendor/babel.standalone.js?raw';

const POLICY = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:" />`;
// The shape of the runtime's compileAndRunScript() block at the vendored commit.
const COMPILE = /<script>\n\(function\(\) \{\n {2}var source = (".*");\n {2}var options = (\{.*\});\n[\s\S]*?\n\}\)\(\);\n<\/script>/g;
const FONT_LINK = /<link [^>]*\bhref="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^>]*>\n?/g;
const REMOTE = /\b(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)|url\(\s*["']?(https?:\/\/[^"')\s]+)/g;

let babel;
function compile(source, options) {
  if (!babel) {
    const m = { exports: {} };
    // Its debug module reads a bare localStorage, which Node 25+ warns about; it gets none here.
    new Function('module', 'exports', 'localStorage', BABEL)(m, m.exports, undefined);
    babel = m.exports;
  }
  // Script text ends at the first </script, so the compiled code never carries one.
  return babel.transform(source, options).code.replace(/<(?=\/script|!--|script)/gi, '\\x3C');
}

// The mock's HTML, plus the remote addresses the design names, which the page's policy keeps from loading.
export function buildMock(jsx) {
  const babelTag = `<script>${BABEL}</script>`;
  let html = buildHtmlDocument(jsx, { prettify: false, bannerComment: 'Made with first-draft, built on Open CoDesign (MIT)' });
  if (!html.includes(babelTag)) throw new Error('the vendored Open CoDesign runtime no longer embeds Babel as this build expects');
  html = html.split(babelTag).join('');
  html = html.replace(COMPILE, (_, source, options) => {
    try {
      return `<script>(function (React, ReactDOM) {\n${compile(JSON.parse(source), JSON.parse(options))}\n})(window.React, window.ReactDOM);</script>`;
    } catch (e) {
      throw new Error(`the design's App.jsx does not compile: ${e.message.split('\n')[0]}`);
    }
  });
  if (html.includes('window.Babel')) throw new Error('the vendored Open CoDesign runtime compiles JSX in a way this build does not expect');
  html = html.replace(FONT_LINK, '').replace(/<head[^>]*>/i, (head) => `${head}\n${POLICY}`);
  return { html, remote: [...new Set([...html.matchAll(REMOTE)].map((m) => m[1] ?? m[2]))] };
}
