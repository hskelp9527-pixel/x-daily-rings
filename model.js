// Pure logic, shared by content.js (isolated world) and Node tests (loaded via vm).
globalThis.XDR = (() => {
  const KINDS = ['post', 'reply', 'quote'];
  const LABELS = { post: '发帖', reply: '回复', quote: '引用' };
  const TIERS = [25, 50, 75, 100];
  const MESSAGES = {
    25: ['开了个好头，先把手热起来。', '四分之一了，节奏对了就别停。', '起步完成，今天状态不错。'],
    50: ['过半了，剩下的一半就是坚持。', '一半到手，别让手停下来。', '进度过半，今天的你在线。'],
    75: ['只差最后一段了，冲一下。', '四分之三，终点就在眼前。', '快了，再来几条就满环。'],
    100: ['今天的任务已达标，离你成为大 V 的路上又近了一天。', '满环！今天的输出不打折。', '收工！数量就是这样一条一条攒出来的。']
  };

  const pad = n => String(n).padStart(2, '0');
  const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const parse = value => {
    if (typeof value !== 'string') return value ?? null;
    try { return JSON.parse(value); } catch { return null; }
  };

  // X's own CreateTweet / CreateNoteTweet request + response → what you just published.
  // A reply to one of your own tweets is a thread continuation, so it counts as a post.
  function classifyCreate(body, text, ownIds = new Set()) {
    const data = parse(text)?.data;
    const result = data?.create_tweet?.tweet_results?.result ?? data?.notetweet_create?.tweet_results?.result;
    if (!result) return null;
    const id = result.rest_id ?? result.tweet?.rest_id ?? null;
    const vars = parse(parse(body)?.variables) ?? {};
    const replyTo = vars.reply?.in_reply_to_tweet_id;
    if (replyTo) return { kind: ownIds.has(String(replyTo)) ? 'post' : 'reply', id };
    if (/\/status\/\d+/.test(vars.attachment_url ?? '')) return { kind: 'quote', id };
    return { kind: 'post', id };
  }

  const unfollowUid = body => new URLSearchParams(typeof body === 'string' ? body : '').get('user_id');

  // Highest tier crossed going from prev to next, or 0.
  function crossedTier(prev, next, goal) {
    if (!(goal > 0)) return 0;
    let hit = 0;
    for (const t of TIERS) if (prev * 100 < t * goal && next * 100 >= t * goal) hit = t;
    return hit;
  }

  const message = (tier, rand = Math.random) => {
    const list = MESSAGES[tier];
    return list[Math.floor(rand() * list.length)];
  };

  const emptyDay = () => ({ post: 0, reply: 0, quote: 0, unfollow: 0 });

  return { KINDS, LABELS, TIERS, MESSAGES, dayKey, classifyCreate, unfollowUid, crossedTier, message, emptyDay };
})();
