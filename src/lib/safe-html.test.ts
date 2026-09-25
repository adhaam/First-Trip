import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, escapeHtmlMultiline } from './safe-html'

test('escapeHtml neutralises tags, script closers, quotes and ampersands', () => {
  assert.equal(
    escapeHtml('<img src=x onerror=alert(1)> </script><script>alert(1)</script> "\' & مرحبا'),
    '&lt;img src=x onerror=alert(1)&gt; &lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt; &quot;&#39; &amp; مرحبا',
  )
})

test('escapeHtmlMultiline preserves only line breaks as markup', () => {
  assert.equal(escapeHtmlMultiline('one\n<img src=x onerror=alert(1)>'), 'one<br>&lt;img src=x onerror=alert(1)&gt;')
})
