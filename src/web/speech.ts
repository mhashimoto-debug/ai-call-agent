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
 *
 * 応答の再生（playSegments）もここに置く。録音（MP3）のある区間は録音、
 * 無い区間は読み上げで、区間の並びどおりに順に鳴らす。
 */
import type { SpeechSegment } from "../demo/voiceLines.js";

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
// ユーザー名が日本語の説明のアドレス（「会社名@gmail.com」）も @ 以降を読み下すため、ユーザー名の英字は必須にしない
const EMAIL = /[A-Za-z0-9._%+-]*@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
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
  const token = playbackToken();
  const sentences = splitForSpeech(speechText(raw));
  for (let i = 0; i < sentences.length; i++) {
    // 停止されたら残りの文は読まない（cancel() が止めるのは読み上げ中の1文だけのため）
    if (token.cancelled) return;
    await speakOne(sentences[i]!, opt);
    if (i < sentences.length - 1) await wait(opt.gapMs ?? 220);
  }
}

// ---------- 停止 ----------

/** 停止操作のたびに進む世代番号。再生途中のループは、これが変わったら残りを鳴らさない。 */
let generation = 0;

export interface PlaybackToken {
  readonly cancelled: boolean;
}

/** 再生を始めるときに取る。以降に stopAll() が呼ばれると cancelled が true になる。 */
export function playbackToken(): PlaybackToken {
  const started = generation;
  return {
    get cancelled() {
      return started !== generation;
    },
  };
}

/** 読み上げ・録音をすべて止める（リセット・マイク開始・読み上げOFFから呼ぶ）。応答の残りの区間も鳴らさない。 */
export function stopAll(): void {
  generation++;
  window.speechSynthesis?.cancel();
  stopAudio();
}

// ---------- 録音ファイルの再生（MP3 優先再生） ----------
//
// 各フェーズ・ガードレールには収録済みの音声（public/audio/*.mp3）がある。
// 合成音声より収録音声のほうが自然なので、対応する録音があるときは必ずそちらを先に鳴らし、
// 見つからない・鳴らせない場合だけ speakUtterance() にフォールバックする。

let currentAudio: HTMLAudioElement | null = null;
/** 再生中の録音の完了待ちを解く。停止したときに呼んで、待っている側を先へ進める。 */
let settleCurrent: ((ok: boolean) => void) | null = null;

function stopAudio(): void {
  const a = currentAudio;
  const settle = settleCurrent;
  currentAudio = null;
  settleCurrent = null;
  if (a) {
    a.pause();
    a.currentTime = 0;
  }
  settle?.(false);
}

/** 録音の読み込みを始めておく。連続再生で次の区間を待たせないよう、鳴らす前にまとめて呼ぶ。 */
export function loadClip(url: string): HTMLAudioElement {
  const audio = new Audio(url);
  audio.preload = "auto";
  audio.load();
  return audio;
}

/**
 * 読み込みを始めた録音を1本鳴らす。鳴り終わるまで解決しないので、ログの表示と音声がずれない。
 * 戻り値は「最後まで鳴らせたか」。ファイルが無い・デコードできない・停止された場合は false。
 */
export function playClip(audio: HTMLAudioElement): Promise<boolean> {
  stopAudio();
  // 読み込みの段階で失敗していれば（404 など）、待たずに読み上げへ回す
  if (audio.error) return Promise.resolve(false);
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean): void => {
      if (done) return;
      done = true;
      if (currentAudio === audio) {
        currentAudio = null;
        settleCurrent = null;
      }
      resolve(ok);
    };
    currentAudio = audio;
    settleCurrent = finish;
    audio.onended = () => finish(true);
    audio.onerror = () => finish(false);
    // 自動再生がブロックされた場合も同様（マイク操作後なので通常は起きない）
    audio.play().catch(() => finish(false));
  });
}

// ---------- 応答の再生（区間の連続再生） ----------

/**
 * 再生の単位にまとめる。録音の無い区間が続くときは1回の読み上げにつなげる
 * （区間ごとに読み上げを分けると、文の途中で間が空いて不自然になるため）。
 */
export function playbackRuns(segments: readonly SpeechSegment[]): SpeechSegment[] {
  const runs: SpeechSegment[] = [];
  for (const s of segments) {
    const prev = runs.at(-1);
    if (prev && !prev.audioFile && !s.audioFile) runs[runs.length - 1] = { text: prev.text + s.text };
    else runs.push(s);
  }
  return runs;
}

/** 区間の鳴らし方。ブラウザでの実際の再生と、テストでの差し替えを同じ手順で動かすために分けてある。 */
export interface SegmentPlayer<C> {
  /** 録音の読み込みを始める（鳴らす前にまとめて呼ぶ） */
  load(url: string): C;
  /** 読み込んだ録音を鳴らす。最後まで鳴れば true */
  play(clip: C): Promise<boolean>;
  /** テキストを読み上げる */
  speak(text: string): Promise<void>;
}

/**
 * 応答の区間を順に鳴らす。
 * 録音は最初にまとめて読み込みを始めるので、1本目を鳴らしている間に後続が揃い、つなぎ目で待たない。
 * 録音を鳴らせなかった区間は、その区間のテキストを読み上げて補う。停止されたら残りは鳴らさない。
 */
export async function playSegments<C>(
  segments: readonly SpeechSegment[],
  player: SegmentPlayer<C>,
  token: PlaybackToken,
): Promise<void> {
  const queue = playbackRuns(segments).map((run) => ({
    run,
    clip: run.audioFile ? player.load(run.audioFile) : undefined,
  }));
  for (const { run, clip } of queue) {
    if (token.cancelled) return;
    if (clip !== undefined && (await player.play(clip))) continue;
    // 停止で打ち切られた場合は、読み上げで補わずにそのまま終える
    if (token.cancelled) return;
    await player.speak(run.text);
  }
}
