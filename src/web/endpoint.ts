/**
 * 発話完了（話し終わり）の判定。
 *
 * ブラウザの音声認識に任せると、文の途中の短い間（「決算月は3月で…」）でも認識が終わってしまい、
 * 相手が話し終わる前に AI が次のセリフを被せてしまう。
 * そこで認識は続けたまま、認識結果が届かない時間（＝無音）を自前で数えて話し終わりを決める。
 *
 * - 無音が SILENCE_TIMEOUT_MS 続いたら話し終わりとみなす
 * - 「〜で」「〜ですが」「〜から」のように続きがありそうな切れ方なら、さらに CONTINUATION_EXTRA_MS 待つ
 *
 * DOM に依存しないので、ブラウザ無しでテストできる。
 */

/** 話し終わりとみなす無音の長さ。短いと文の途中の間で割り込み、長いと応答が遅れる。 */
export const SILENCE_TIMEOUT_MS = 1300;

/** 続きがありそうな切れ方のときに、追加で待つ時間。 */
export const CONTINUATION_EXTRA_MS = 1200;

/**
 * 続きがありそうな文末。
 * 接続助詞（〜で・〜でして・〜ですが・〜けど・〜から・〜ので・〜し・〜て）、
 * 格助詞・並立助詞（〜は・〜が・〜と・〜の・〜に・〜を・〜も・〜や）、
 * 言いよどみ・引き伸ばし（えーっと・あの・まあ・「3月でー」）、
 * メールアドレス・番号の読み上げ途中（アット・ドット・ハイフン）。
 */
const CONTINUATION_END =
  /(でして|ですが|ですけど|ですけれども|ですけれど|ますが|ますけど|けれども|けれど|けど|から|ので|のに|ながら|たり|たら|なら|って|し|て|で|と|が|は|の|に|を|も|や|へ|えーっと|えっと|えーと|あのー|あの|そのー|その|まあ|なんか|あと|それと|アット|ドット|ハイフン|[@.\-－ー])$/;

/** 文末が、続きがありそうな切れ方になっているか。 */
export function endsWithContinuation(text: string): boolean {
  const t = text.replace(/\s+$/, "");
  if (!t) return false;
  // 句点・疑問符で終わっていれば言い切っている
  if (/[。？?！!]$/.test(t)) return false;
  // 読点・「…」で終わっていれば言いさし
  if (/[、，,…]$/.test(t)) return true;
  return CONTINUATION_END.test(t);
}

/** この発話のあと、話し終わりとみなすまでに待つ無音の長さ。 */
export function silenceWaitMs(text: string): number {
  return SILENCE_TIMEOUT_MS + (endsWithContinuation(text) ? CONTINUATION_EXTRA_MS : 0);
}

/** タイマーの差し替え口（テストでは手で進める時計を渡す）。 */
export interface Scheduler {
  set(fn: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

const realScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/**
 * 認識結果が届くたびに無音待ちをやり直し、無音が続いたら話し終わりを通知する。
 * 暫定結果（interim）も「まだ話している」合図として扱う。
 */
export class EndpointDetector {
  private handle: unknown = null;
  private latest = "";

  constructor(
    private readonly onEndpoint: (text: string) => void,
    private readonly scheduler: Scheduler = realScheduler,
  ) {}

  /** ここまでに聞き取れたテキスト（確定分＋暫定分）。 */
  get text(): string {
    return this.latest;
  }

  /** 認識結果が届いたときに呼ぶ。無音待ちをやり直す。 */
  feed(text: string): void {
    this.latest = text;
    this.cancel();
    if (!text.trim()) return;
    this.handle = this.scheduler.set(() => {
      this.handle = null;
      this.onEndpoint(this.latest);
    }, silenceWaitMs(text));
  }

  /** 無音待ちをやめる（手動で確定したとき・破棄したとき）。 */
  cancel(): void {
    if (this.handle === null) return;
    this.scheduler.clear(this.handle);
    this.handle = null;
  }
}
