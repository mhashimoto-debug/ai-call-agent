/**
 * Web Speech API（SpeechRecognition）のラッパー。
 *
 * 標準の lib.dom には型が無く、実装も webkit 接頭辞付きのため、
 * 必要な範囲だけをここで型定義して吸収する。
 * 対応状況: Chrome / Edge / Safari。Firefox は未対応（起動時に判定して伝える）。
 */
import { EndpointDetector } from "./endpoint.js";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onspeechend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function ctor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const micSupported = (): boolean => ctor() !== null;

/** エラーコードを利用者に見せる日本語に変換する。 */
export function micErrorMessage(code: string): string {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "マイクの使用が許可されていません。ブラウザのアドレスバーからマイクを許可してください。";
    case "no-speech":
      return "音声が検出されませんでした。もう一度お試しください。";
    case "audio-capture":
      return "マイクが見つかりません。入力デバイスを確認してください。";
    case "network":
      return "音声認識サーバに接続できませんでした。ネットワークを確認してください。";
    case "aborted":
      return "音声入力を中止しました。";
    default:
      return `音声認識でエラーが発生しました（${code}）。`;
  }
}

export interface MicHandlers {
  /** 認識途中の暫定テキスト（画面に薄く出す用） */
  onInterim?: (text: string) => void;
  /** 確定したテキスト */
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd?: () => void;
}

/**
 * 1回分の音声入力。
 * 押して話す → 話し終わりを検出して自動で確定する運用を想定している。
 *
 * 話し終わりはブラウザの判定に任せない（continuous = false だと文の途中の短い間でも認識が終わり、
 * 相手が話し終わる前に AI が被せて喋り出す）。認識は続けたまま、無音の長さを endpoint.ts で数えて決める。
 */
export class MicInput {
  private rec: SpeechRecognitionLike | null = null;
  private finalText = "";
  /** ここまでに聞き取れたテキスト（確定分＋暫定分）。止めた時点で確定しきれていない分も含めて渡すため。 */
  private heard = "";
  private endpoint: EndpointDetector | null = null;

  get listening(): boolean {
    return this.rec !== null;
  }

  start(handlers: MicHandlers): void {
    const C = ctor();
    if (!C) {
      handlers.onError("このブラウザは音声認識に対応していません（Chrome / Edge / Safari をお使いください）。");
      return;
    }
    if (this.rec) return;

    const rec = new C();
    rec.lang = "ja-JP";
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    this.finalText = "";
    this.heard = "";
    // 無音が続いたら話し終わり。認識を止めると onend で確定テキストを渡す
    const endpoint = new EndpointDetector(() => {
      if (this.rec === rec) rec.stop();
    });
    this.endpoint = endpoint;

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) this.finalText += text;
        else interim += text;
      }
      this.heard = this.finalText + interim;
      if (interim) handlers.onInterim?.(this.heard);
      // 結果が届いた＝まだ話している。無音待ちをやり直す
      endpoint.feed(this.heard);
    };
    rec.onerror = (e) => {
      handlers.onError(micErrorMessage(e.error));
    };
    rec.onend = () => {
      endpoint.cancel();
      if (this.endpoint === endpoint) this.endpoint = null;
      this.rec = null;
      const text = (this.heard.length > this.finalText.length ? this.heard : this.finalText).trim();
      if (text) handlers.onFinal(text);
      handlers.onEnd?.();
    };

    this.rec = rec;
    rec.start();
  }

  /** 手動で確定させる（話し終わりの自動検出を待たない）。 */
  stop(): void {
    this.endpoint?.cancel();
    this.rec?.stop();
  }

  /** 破棄する（結果は使わない）。 */
  abort(): void {
    this.endpoint?.cancel();
    this.endpoint = null;
    const r = this.rec;
    this.rec = null;
    r?.abort();
  }
}
