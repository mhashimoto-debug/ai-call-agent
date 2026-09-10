/**
 * Web Speech API のラッパー。
 *
 * やっていること:
 *   1. 日本語ボイスの中から最も自然に聞こえるものを優先選択する
 *   2. 読み上げ用にテキストを正規化する（記号・英略語・金額・括弧書き）
 *   3. 文単位に分割して順に読み、文の切れ目に自然なポーズを入れる
 *
 * ブラウザの TTS は SSML を受け付けないため、ポーズは
 * 「文を分けて間隔を空けて読む」ことで作っている。
 */

// ---------- ボイス選択 ----------

/**
 * 音声名から品質を推定するヒント。
 * ニューラル音声（Edge の Natural、Chrome の Google 日本語、macOS の Enhanced）を優先する。
 */
const VOICE_HINTS: [RegExp, number][] = [
  [/natural/i, 100], // Microsoft Nanami/Keita Online (Natural) — 最も自然
  [/google/i, 80], // Chrome の Google 日本語
  [/(enhanced|premium|siri)/i, 60], // macOS の高品質版
  [/(nanami|keita|kyoko|otoya|o-ren|sayaka|ichiro|mizuki|takumi|ayumi|haruka)/i, 40],
];

export function scoreVoice(v: SpeechSynthesisVoice): number {
  let score = 0;
  for (const [re, pt] of VOICE_HINTS) if (re.test(v.name)) score += pt;
  // クラウド側で合成される音声は概ねニューラルで自然
  if (!v.localService) score += 20;
  if (v.default) score += 5;
  return score;
}

/** getVoices() は非同期に埋まるブラウザがあるため、voiceschanged を待つ。 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length > 0) return Promise.resolve(now);
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => resolve(window.speechSynthesis.getVoices()), 1200);
    window.speechSynthesis.addEventListener(
      "voiceschanged",
      () => {
        window.clearTimeout(timer);
        resolve(window.speechSynthesis.getVoices());
      },
      { once: true },
    );
  });
}

/** 日本語ボイスを品質推定の高い順に返す。 */
export async function japaneseVoices(): Promise<SpeechSynthesisVoice[]> {
  const all = await loadVoices();
  return all
    .filter((v) => v.lang.toLowerCase().startsWith("ja"))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a));
}

// ---------- 読み上げテキストの正規化 ----------

const WEEKDAY = /（([月火水木金土日])）/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(\d{2,4})-(\d{2,4})-(\d{3,4})/g;
const DOMAIN_KANA: Record<string, string> = {
  co: "シーオー",
  jp: "ジェイピー",
  com: "コム",
  ne: "エヌイー",
  or: "オーアール",
  ac: "エーシー",
  go: "ジーオー",
  net: "ネット",
  org: "オーグ",
};

const DISCOURSE = /(^|[。！？」])(実は|さらに|つまり|ちなみに|ですので|それでは)(?![、。])/g;

/**
 * 発話テキストを読み上げ向けに整える。
 * 画面に表示する文字列は変えず、音声に渡す直前だけ変換する。
 */
export function speechText(raw: string): string {
  let t = raw;

  // 曜日の括弧は読み上げると「かっこ すい かっこ」になるため展開し、
  // 直後に時刻が続く場合は読点で区切って「17日水曜日、14時から」と読ませる
  t = t.replace(WEEKDAY, "$1曜日").replace(/([月火水木金土日]曜日)(?=\d)/g, "$1、");

  // メールアドレスは記号を読み下す（電話口で復唱する形に合わせる）。
  // co / jp のような定型ラベルはカナに開く。
  // 任意の英単語（ローカル部・ドメイン名）はブラウザの読みに任せる。
  t = t.replace(EMAIL, (m) =>
    m
      .replace(/@/g, " アットマーク ")
      .replace(/\./g, " ドット ")
      .replace(/-/g, " ハイフン ")
      .replace(/\b(co|jp|com|ne|or|ac|go|net|org)\b/gi, (w) => DOMAIN_KANA[w.toLowerCase()] ?? w),
  );

  // 電話番号のハイフンは日本語では「の」
  t = t.replace(PHONE, "$1の$2の$3");

  // 残りの括弧書きは補足なので読み上げない
  t = t.replace(/[（(][^）)]*[）)]/g, "");

  // 英略語・サービス名をカタカナに寄せる（英語読みへの切り替わりを防ぐ）
  t = t
    .replace(/iDeCo/gi, "イデコ")
    .replace(/Zoom/gi, "ズーム")
    .replace(/URL/g, "ユーアールエル")
    .replace(/企業型DC/g, "企業型ディーシー")
    .replace(/\bDC\b/g, "ディーシー")
    .replace(/SMS/g, "エスエムエス");

  // 桁区切りのカンマで読みが切れるのを防ぎ、主要な金額は漢数字で読ませる
  t = t.replace(/(\d),(\d{3})/g, "$1$2");
  t = t.replace(/55000円/g, "五万五千円").replace(/62000円/g, "六万二千円");

  // 接続表現のあとに読点を入れて、人が話すときの間を作る
  t = t.replace(DISCOURSE, "$1$2、");

  // 全角スペースや連続空白は間延びの原因になるので整理し、
  // 日本語どうしの間に残った空白（「ズーム で」等）は詰める。
  // 英数字が隣接する箇所（メールの読み下し）の空白は区切りとして残す。
  return t
    .replace(/[　\s]+/g, " ")
    .replace(/(?<=[^\x00-\x7F])\s+(?=[^\x00-\x7F])/g, "")
    .trim();
}

/** 文単位に分割する。短すぎる断片は前の文にくっつける。 */
export function splitForSpeech(text: string): string[] {
  const parts = text
    .split(/(?<=[。！？])/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    const prev = out.at(-1);
    // 「はい。」のような単独では短すぎる断片だけを前の文に結合する
    if (prev && prev.length < 8) out[out.length - 1] = `${prev}${p}`;
    else out.push(p);
  }
  return out.length > 0 ? out : [text];
}

// ---------- 読み上げ ----------

export interface SpeakOptions {
  voice: SpeechSynthesisVoice | null;
  rate?: number;
  pitch?: number;
  /** 文と文のあいだに空ける時間(ms) */
  gapMs?: number;
}

function speakOne(text: string, opt: SpeakOptions): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = opt.rate ?? 1.0;
    u.pitch = opt.pitch ?? 1.0;
    if (opt.voice) u.voice = opt.voice;

    let done = false;
    const finish = (): void => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    };
    u.onend = finish;
    u.onerror = finish;
    // onend が発火しないブラウザ向けの保険（文字数から上限を概算）
    const timer = window.setTimeout(finish, Math.max(3500, text.length * 260));
    window.speechSynthesis.speak(u);
  });
}

const wait = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/**
 * 発話を最後まで読み上げる。読み終わるまで解決しない。
 * これによりログの表示と音声のタイミングが一致する。
 */
export async function speakUtterance(raw: string, opt: SpeakOptions): Promise<void> {
  if (!("speechSynthesis" in window) || !raw.trim()) return;
  const sentences = splitForSpeech(speechText(raw));
  for (let i = 0; i < sentences.length; i++) {
    await speakOne(sentences[i]!, opt);
    if (i < sentences.length - 1) await wait(opt.gapMs ?? 220);
  }
}

// ---------- 録音ファイルの再生（MP3 優先再生） ----------
//
// 各フェーズ・ガードレールには収録済みの音声（public/audio/*.mp3）がある。
// 合成音声より収録音声のほうが自然なので、対応する録音があるときは必ずそちらを先に鳴らし、
// 見つからない・鳴らせない場合だけ speakUtterance() にフォールバックする。

let currentAudio: HTMLAudioElement | null = null;

/** 再生中の録音を止める（リセット・マイク開始・停止操作から呼ぶ）。 */
export function stopAudio(): void {
  const a = currentAudio;
  currentAudio = null;
  if (!a) return;
  a.pause();
  a.currentTime = 0;
}

/**
 * 録音を1本再生する。鳴り終わるまで解決しないので、ログの表示と音声がずれない。
 * 戻り値は「実際に再生できたか」。false ならフォールバックして読み上げる。
 */
export function playAudioFile(url: string): Promise<boolean> {
  stopAudio();
  return new Promise((resolve) => {
    const audio = new Audio(url);
    currentAudio = audio;

    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      if (currentAudio === audio) currentAudio = null;
      resolve(ok);
    };

    audio.onended = () => finish(true);
    // ファイルが無い・デコードできない場合は読み上げに回す
    audio.onerror = () => finish(false);
    // 自動再生がブロックされた場合も同様（マイク操作後なので通常は起きない）
    audio.play().catch(() => finish(false));
  });
}
