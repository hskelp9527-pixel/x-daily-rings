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
      'Warm-up done. Keep the streak going.', 'Real artists ship. —— Steve Jobs'
    ],
    50: [
      '过半了，剩下的一半靠坚持。', '一半到手，别让手停下来。', '慢慢来，比较快。',
      '把每一件简单的事做好就是不简单。——张瑞敏', '锲而不舍，金石可镂。——荀子',
      '按数量练的那组，反而做得最好。——《艺术与恐惧》', "Halfway there. Don't stop now.",
      'Small daily improvements over time lead to stunning results. —— Robin Sharma',
      "You miss 100% of the shots you don't take. —— Wayne Gretzky"
    ],
    75: [
      '只差最后一段了，冲一下。', '快了，再来几条就满环。', '最后这几条，往往是最有手感的几条。',
      '别在这里停，满环就差一口气。', '行百里者半九十。——《战国策》',
      'Show up, show up, show up, and after a while the muse shows up, too. —— Isabel Allende',
      'Success is the sum of small efforts, repeated day in and day out. —— Robert Collier',
      'Almost there. Finish strong.'
    ],
    100: [
      FIRST_FULL, '满环！今天的输出不打折。', '收工！数量就是这样一条一条攒出来的。',
      '达标了。明天的你，会感谢今天没偷懒的你。', '量变攒够了，质变就在路上。',
      '苟日新，日日新，又日新。——《礼记·大学》', "Be so good they can't ignore you. —— Steve Martin",
      'Stay hungry, stay foolish. —— Steve Jobs', 'Ring closed. See you tomorrow.'
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

  const emptyDay = () => ({ post: 0, reply: 0, quote: 0, unfollow: 0, full: false });

  return { KINDS, LABELS, TIERS, MESSAGES, FIRST_FULL, dayKey, classifyCreate, unfollowUid, crossedTier, message, emptyDay };
})();
