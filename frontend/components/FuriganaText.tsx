"use client";

import { Fragment, useMemo, type ReactNode } from "react";
import { FURIGANA_KEYS_DESC, lookupFurigana } from "@/lib/furiganaDictionary";
import { useReading } from "@/context/ReadingContext";
import { displaySubject } from "@/lib/subjects";
import { formatDateJa, formatDateTimeJa } from "@/lib/utils";

const KANJI_RE = /[\u4e00-\u9fff\u3400-\u4dbf\uF900-\uFAFF]/;

function containsKanji(text: string): boolean {
  return [...text].some((ch) => KANJI_RE.test(ch));
}

function splitKanjiRuns(text: string): { text: string; isKanji: boolean }[] {
  const runs: { text: string; isKanji: boolean }[] = [];
  for (const ch of text) {
    const isKanji = KANJI_RE.test(ch);
    const last = runs[runs.length - 1];
    if (last && last.isKanji === isKanji) {
      last.text += ch;
    } else {
      runs.push({ text: ch, isKanji });
    }
  }
  return runs;
}

function Ruby({ text, reading }: { text: string; reading: string }) {
  return (
    <ruby className="furigana-ruby">
      {text}
      <rt>{reading}</rt>
    </ruby>
  );
}

/** 漢字部分だけ ruby を付け、ひらがな・カタカナ・英字はそのまま表示 */
function renderWordWithReading(word: string, fullReading: string, keyStart: number): ReactNode[] {
  const runs = splitKanjiRuns(word);
  const nodes: ReactNode[] = [];
  let key = keyStart;
  let reading = fullReading;

  for (let ri = 0; ri < runs.length; ri++) {
    const run = runs[ri];
    if (!run.isKanji) {
      nodes.push(<Fragment key={key++}>{run.text}</Fragment>);
      if (reading.startsWith(run.text)) {
        reading = reading.slice(run.text.length);
      }
      continue;
    }

    let rt = reading;
    let consumed = false;
    for (let j = ri + 1; j < runs.length; j++) {
      if (!runs[j].isKanji && runs[j].text) {
        const pos = reading.indexOf(runs[j].text);
        if (pos >= 0) {
          rt = reading.slice(0, pos);
          reading = reading.slice(pos);
          consumed = true;
          break;
        }
      }
    }
    if (!consumed) {
      rt = reading;
      reading = "";
    }

    if (rt) {
      nodes.push(<Ruby key={key++} text={run.text} reading={rt} />);
    } else {
      nodes.push(<Fragment key={key++}>{run.text}</Fragment>);
    }
  }

  return nodes;
}

function renderWithFurigana(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < text.length) {
    let matched = false;
    for (const word of FURIGANA_KEYS_DESC) {
      if (!text.startsWith(word, i)) continue;
      const reading = lookupFurigana(word);
      if (!reading) continue;

      if (!containsKanji(word)) {
        nodes.push(<Fragment key={key++}>{word}</Fragment>);
      } else {
        const wordNodes = renderWordWithReading(word, reading, key);
        nodes.push(...wordNodes);
        key += wordNodes.length;
      }
      i += word.length;
      matched = true;
      break;
    }
    if (matched) continue;

    nodes.push(<Fragment key={key++}>{text[i]}</Fragment>);
    i += 1;
  }

  return nodes;
}

type FuriganaTextProps = {
  children: string;
  className?: string;
  as?: "span" | "p" | "div" | "h1" | "h2" | "h3" | "label" | "dt" | "dd" | "li" | "button";
};

export default function FuriganaText({ children, className, as: Tag = "span" }: FuriganaTextProps) {
  const { showFurigana } = useReading();
  const content = useMemo(() => {
    if (!showFurigana) return children;
    return renderWithFurigana(children);
  }, [children, showFurigana]);

  return <Tag className={className}>{content}</Tag>;
}

export function Ft(props: FuriganaTextProps) {
  return <FuriganaText {...props} />;
}

export function FuriganaSubject({ subject, grade }: { subject: string; grade: number }) {
  const { showFurigana } = useReading();
  const label = displaySubject(subject, grade);
  if (!showFurigana || !containsKanji(label)) return <>{label}</>;
  const reading = lookupFurigana(label);
  if (!reading) return <>{label}</>;
  return <>{renderWordWithReading(label, reading, 0)}</>;
}

export function FormatDateJa({ iso }: { iso: string | Date }) {
  const { showFurigana } = useReading();
  const formatted = formatDateJa(iso);
  if (!showFurigana) return <>{formatted}</>;
  return <>{renderWithFurigana(formatted)}</>;
}

export function FormatDateTimeJa({ iso }: { iso: string | Date }) {
  const { showFurigana } = useReading();
  const formatted = formatDateTimeJa(iso);
  if (!showFurigana) return <>{formatted}</>;
  return <>{renderWithFurigana(formatted)}</>;
}
