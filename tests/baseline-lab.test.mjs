import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../baseline-lab/index.html', import.meta.url), 'utf8');

test('history renders saved session context as text, not interpolated HTML', () => {
  assert.match(source, /context\.className='ctx'; context\.textContent=ctx\|\|'No session label'/);
  assert.doesNotMatch(source, /class="ctx">'\+\(ctx/);
});

test('reaction onset and transition timers clear their handles before reuse', () => {
  assert.match(source, /waitTimer=setTimeout\(\(\)=>\{waitTimer=null;ready=true;/);
  assert.match(source, /transitionTimer=setTimeout\(\(\)=>\{transitionTimer=null;schedule\(\)\},450\)/);
  assert.match(source, /cleanup=\(\)=>\{closed=true;clearTimeout\(waitTimer\);clearTimeout\(transitionTimer\)\}/);
});
