// Pure logic, shared by content.js (isolated world) and Node tests (loaded via vm).
globalThis.XDR = (() => {
  const KINDS = ['post', 'reply', 'quote'];
  const LABELS = { post: '发帖', reply: '回复', quote: '引用' };
  const TIERS = [25, 50, 75, 100];
  const FIRST_FULL = '今天的任务已达标，离你成为大 V 的路上又近了一天。';
  const MESSAGES = {
    25: [
      '开了个好头，先把手热起来。', '第一圈转起来了，接着来。', '先发出去，再慢慢变好。',
      '怕什么真理无穷，进一寸有一寸的欢喜。——胡适', '千里之行，始于足下。——老子',
      'Done is better than perfect. —— Facebook 办公室标语',
      'Inspiration exists, but it has to find you working. —— Picasso',
      'Warm-up done. Keep the streak going.', 'Real artists ship. —— Steve Jobs',
      "You miss 100% of the shots you don't take. —— Wayne Gretzky"
    ],
    50: [
      '过半了，剩下的一半靠坚持。', '一半到手，别让手停下来。', '一条一条来，手感会越来越顺。',
      '把每一件简单的事做好就是不简单。——张瑞敏', '锲而不舍，金石可镂。——荀子',
      '只管多做的那组，最后作品反而最好。——《艺术与恐惧》', "Halfway there. Don't stop now.",
      'Small daily improvements over time lead to stunning results. —— Robin Sharma'
    ],
    75: [
      '只差最后一段了，冲一下。', '快了，再来几条就满环。', '最后这几条，往往是最有手感的几条。',
      '别在这里停，满环就差一口气。', '行百里者半九十。——《战国策》',
      'Show up, show up, show up. —— Isabel Allende',
      'Bird by bird. —— Anne Lamott',
      'Almost there. Finish strong.'
    ],
    100: [
      FIRST_FULL, '满环！今天的输出不打折。', '收工！数量就是这样一条一条攒出来的。',
      '达标了。明天的你，会感谢今天没偷懒的你。', '量变攒够了，质变就在路上。',
      '苟日新，日日新，又日新。——《礼记·大学》', '功不唐捐。——胡适',
      'Stay hungry, stay foolish. —— Whole Earth Catalog', 'Ring closed. See you tomorrow.'
    ]
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
    if (vars.edit_options?.previous_tweet_id) return null; // editing reuses CreateTweet
    const replyTo = vars.reply?.in_reply_to_tweet_id;
    if (replyTo) {
      const legacy = result.legacy ?? result.tweet?.legacy;
      const self = legacy?.in_reply_to_user_id_str != null && legacy.in_reply_to_user_id_str === legacy.user_id_str;
      return { kind: self || ownIds.has(String(replyTo)) ? 'post' : 'reply', id };
    }
    if (/\/status\/\d+/.test(vars.attachment_url ?? '')) return { kind: 'quote', id };
    return { kind: 'post', id };
  }

  // X's own UserTweetsAndReplies response (your profile's Replies tab) → your tweets from day `key`,
  // same rules as classifyCreate. Catches what you published on your phone. Retweets are skipped.
  function profileTweets(text, handle, key) {
    const out = new Map(), me = String(handle ?? '').toLowerCase();
    const walk = o => {
      if (!o || typeof o !== 'object') return;
      const l = o.legacy, u = o.core?.user_results?.result;
      if (o.rest_id && typeof l?.full_text === 'string' && l.created_at && !l.retweeted_status_result
        && String(u?.core?.screen_name ?? u?.legacy?.screen_name).toLowerCase() === me && dayKey(new Date(l.created_at)) === key) {
        const kind = l.in_reply_to_status_id_str ? (l.in_reply_to_user_id_str === l.user_id_str ? 'post' : 'reply') : l.is_quote_status ? 'quote' : 'post';
        out.set(String(o.rest_id), kind);
      }
      for (const v of Object.values(o)) walk(v);
    };
    if (me) walk(parse(text));
    return [...out].map(([id, kind]) => ({ kind, id }));
  }

  // A refused friendships/create: 429, or error 88 (rate limit) / 161 (can't follow more right now).
  const followLimited = (status, text) =>
    status === 429 || (parse(text)?.errors ?? []).some(e => e?.code === 88 || e?.code === 161);

  const unfollowUid =body => new URLSearchParams(typeof body === 'string' ? body : '').get('user_id');

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

  const emptyDay = () => ({ post: 0, reply: 0, quote: 0, unfollow: 0, full: false });

  return { KINDS, LABELS, TIERS, MESSAGES, FIRST_FULL, dayKey, classifyCreate, profileTweets, followLimited, unfollowUid, crossedTier, message, emptyDay };
})();
