// /assets 캐시 버전(?v=N): 파일을 고치고 v를 안 올리면 실패 (scripts/asset-versions.js)
const assert = require('node:assert/strict');
const { check } = require('../../scripts/asset-versions');

module.exports = [
  {
    name: '캐시 버전: 바뀐 /assets 파일은 v도 올림 · 같은 파일은 어디서나 같은 v',
    run: async () => { const errors = check(); assert.deepEqual(errors, [], '\n' + errors.join('\n')); },
  },
];
