import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const handles = [
  'jukan05',
  'LeopoldTracker_',
  'negligible_cap',
  'ShanghaiJin',
  'citrini',
  'daidaibtc',
  'SemiAnalysis_',
];
const token = process.env.X_BEARER_TOKEN;
const now = new Date();
const escape = (value = '') => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const textExcerpt = (text) => text.replace(/\s+/g, ' ').trim().slice(0, 280);

function chinaDate(value) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value));
  const part = (type) => parts.find((item) => item.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

const date = chinaDate(now);

function chinaTime(iso) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso)).replace(/\//g, '-');
}

async function api(pathname) {
  const response = await fetch(`https://api.x.com${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(`X API 返回 ${response.status}`);
  return response.json();
}

let posts = [];
let limitation = '';
if (!token) {
  limitation = '未检测到 X_BEARER_TOKEN；本次没有调用 X API。请在仓库 Actions secrets 中确认该机密存在。';
} else {
  try {
    const users = await api(`/2/users/by?usernames=${handles.join(',')}&user.fields=id,username,name`);
    const userMap = new Map((users.data ?? []).map((user) => [user.id, user]));
    const results = await Promise.all([...userMap.keys()].map(async (id) => {
      const data = await api(`/2/users/${id}/tweets?max_results=20&exclude=retweets,replies&tweet.fields=created_at,entities,referenced_tweets`);
      return (data.data ?? []).map((post) => ({ ...post, author: userMap.get(id) }));
    }));
    posts = results.flat().filter((post) => chinaDate(post.created_at) === date);
    posts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  } catch (error) {
    limitation = `X API 调用未完成：${error.message}。这不代表相关账户没有更新。`;
  }
}

const reportRows = posts.length
  ? posts.map((post) => `| ${chinaTime(post.created_at)}（上海时间） | ${post.author.name} @${post.author.username} | 一手 | 自动抓取到该账户原帖。摘录：${textExcerpt(post.text).replace(/\|/g, '\\|')} | [查看原帖](https://x.com/${post.author.username}/status/${post.id}) |`).join('\n')
  : '| — | X 追踪账户 | 无新增 | 在本次成功获取的数据中，未发现覆盖日期内的新原创帖。 | — |';

const htmlRows = posts.length
  ? posts.map((post) => `<tr><td>${escape(chinaTime(post.created_at))}（上海时间）</td><td>${escape(post.author.name)} @${escape(post.author.username)}</td><td>一手</td><td>自动抓取到该账户原帖。<details><summary>查看原文摘录</summary><p>${escape(textExcerpt(post.text))}</p></details></td><td><a href="https://x.com/${encodeURIComponent(post.author.username)}/status/${post.id}">查看原帖</a></td></tr>`).join('')
  : '<tr><td>—</td><td>X 追踪账户</td><td>无新增</td><td>在本次成功获取的数据中，未发现覆盖日期内的新原创帖。</td><td>—</td></tr>';

const coverage = `覆盖日期：${date}（上海时间）。本页由 X API 自动抓取公开原创帖；转帖和回复默认排除。`;
const report = `# 市场信源每日追踪：${date}\n\n> ${coverage} 仅供信息参考，不构成投资建议。\n\n## 覆盖说明\n\n${limitation || '已使用 X API 检查固定追踪账户。原文摘录仅用于识别内容，完整语境请以原帖为准。'}\n\n| 时间 | 来源 / 作者 | 类型 | 摘要 | 原文 |\n|---|---|---|---|---|\n${reportRows}\n\n## 待核验\n\n- X API 仅能获取可由当前套餐与权限返回的公开数据；受保护、删除、被限制或超出套餐范围的帖子可能无法取得。\n- 自动抓取不判断观点真伪；涉及公司披露、交易或监管信息时，应以一手文件或媒体原文复核。\n`;
const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>市场信源每日追踪：${date}</title><style>body{max-width:860px;margin:0 auto;padding:54px 24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#182230;background:#f5f7fb;line-height:1.7}main{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:26px}a{color:#0759bb;font-weight:650;text-decoration:none}a:hover{text-decoration:underline}table{width:100%;border-collapse:collapse}td,th{padding:12px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}small{color:#687588}summary{cursor:pointer;color:#0759bb}</style></head><body><p><a href="../index.html">← 返回首页</a></p><main><h1>市场信源每日追踪：${date}</h1><p><small>${escape(coverage)} 仅供信息参考，不构成投资建议。</small></p><h2>覆盖说明</h2><p>${escape(limitation || '已使用 X API 检查固定追踪账户。原文摘录仅用于识别内容，完整语境请以原帖为准。')}</p><h2>已发现线索</h2><table><thead><tr><th>时间</th><th>来源 / 作者</th><th>类型</th><th>摘要</th><th>原文</th></tr></thead><tbody>${htmlRows}</tbody></table><h2>待核验</h2><ul><li>X API 仅能获取可由当前套餐与权限返回的公开数据；受保护、删除、被限制或超出套餐范围的帖子可能无法取得。</li><li>自动抓取不判断观点真伪；涉及公司披露、交易或监管信息时，应以一手文件或媒体原文复核。</li></ul></main></body></html>`;

await mkdir('reports', { recursive: true });
await writeFile(`reports/${date}.md`, report);
await writeFile(`reports/${date}.html`, html);

const reportFiles = (await readdir('reports')).filter((file) => /^\d{4}-\d{2}-\d{2}\.html$/.test(file)).sort().reverse();
const historyHtml = reportFiles.map((file) => `<a href="reports/${file}">${file.slice(0, 10)}</a>`).join('<br>');
const index = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>市场信源每日追踪</title><style>:root{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#182230;background:#f5f7fb}body{max-width:860px;margin:0 auto;padding:54px 24px;line-height:1.7}header{border-bottom:1px solid #dce3ee;padding-bottom:24px;margin-bottom:30px}h1{font-size:clamp(30px,5vw,45px);margin:0;letter-spacing:-.04em}.intro{color:#5d6a7c;margin:10px 0 0}.card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:26px;margin:18px 0;box-shadow:0 6px 20px #22314b0a}.tag{color:#146c43;background:#e6f7ed;padding:3px 9px;border-radius:999px;font-size:13px;font-weight:650}a{color:#0759bb;text-decoration:none;font-weight:650}a:hover{text-decoration:underline}footer{color:#687588;font-size:14px;margin-top:38px}</style></head><body><header><h1>市场信源每日追踪</h1><p class="intro">每日汇总重点作者与媒体的公开原文线索，按日期保留完整历史。</p></header><main><section class="card"><span class="tag">最新日报</span><h2>${date}</h2><p>已通过 X API 自动检查固定追踪账户。</p><a href="reports/${date}.html">阅读日报 →</a></section><section class="card"><h2>历史归档</h2><p>${historyHtml}</p></section></main><footer>仅供信息参考，不构成投资建议。自动抓取不等于事实核验。</footer></body></html>`;
await writeFile('index.html', index);

const readme = `# 市场信源每日追踪\n\n这是日报网站的内容仓库；面向读者的首页位于 GitHub Pages。\n\n## 最新日报\n\n- [${date}（上海时间）](reports/${date}.md)\n\n## 历史归档\n\n| 日期 | 日报 |\n|---|---|\n${reportFiles.map((file) => `| ${file.slice(0, 10)} | [查看](reports/${file.slice(0, 10)}.md) |`).join('\n')}\n\n## X API 追踪范围\n\n- Jukan、Leopold Stock Tracker、Negligible Capital、Herman Jin、Citrini、带带带比特、SemiAnalysis\n- 自动抓取仅获取公开原创帖；转帖与回复默认不纳入日报。\n\n内容按证据等级标记，不构成投资建议。`;
await writeFile('README.md', readme);
console.log(`Generated ${date}: ${posts.length} post(s).`);
