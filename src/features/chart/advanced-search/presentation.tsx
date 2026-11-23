"use client";

import { useEffect, useRef, useState } from "react";
import { EmrEmptyState } from "@/components/emr/empty-state";
import { ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  CdsActionsPlayIcon,
  CdsActionsPauseIcon,
} from "@/components/cds-icons/actions-and-controls";
import { CloseIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  representativeMedia,
  type SearchChart,
  type SearchMedia,
} from "./contract";
import { searchWords, speciesLabel } from "./ranking";
import styles from "./workspace.module.css";

export function Pick({
  label,
  value,
  options,
  onChange,
  size = "sm",
}: {
  size?: "sm" | "default";
  label: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <Select
      value={value || null}
      onValueChange={(v) => {
        if (v !== null) onChange(v);
      }}
    >
      <SelectTrigger size={size} aria-label={label}>
        {options.find(([key]) => key === value)?.[1] ?? label}
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map(([key, text]) => (
            <SelectItem key={key} value={key}>
              {text}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
export const when = (value: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
export const stateText = (s: string) =>
  s === "signed" ? "완료" : s === "amended" ? "정정" : "작성 중";
export const animal = speciesLabel;
export function Highlight({ value, query }: { value: string; query: string }) {
  const words = searchWords(query).sort((a, b) => b.length - a.length);
  const parts = [];
  let cursor = 0;
  const lower = value.toLocaleLowerCase();
  while (cursor < value.length) {
    const matches = words
      .map((word) => ({ word, index: lower.indexOf(word, cursor) }))
      .filter((m) => m.index >= 0)
      .sort((a, b) => a.index - b.index);
    const hit = matches[0];
    if (!hit) break;
    parts.push(
      value.slice(cursor, hit.index),
      <mark key={hit.index}>
        {value.slice(hit.index, hit.index + hit.word.length)}
      </mark>,
    );
    cursor = hit.index + hit.word.length;
  }
  return (
    <>
      {parts}
      {value.slice(cursor)}
    </>
  );
}
function PreviewMedia({
  item,
  controls = false,
  inlinePlayback = false,
}: {
  item: SearchMedia;
  controls?: boolean;
  inlinePlayback?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  if (failed)
    return (
      <EmrEmptyState
        surface="widget"
        kind="read-error"
        title="미리보기를 열 수 없습니다"
        reserveActionSpace={false}
      />
    );
  return item.video ? (
    <>
      <video
        ref={video}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        controls={controls}
        preload="metadata"
        playsInline
        muted={!controls}
        aria-label={item.name}
        src={item.url + "#t=0.1"}
        onError={() => setFailed(true)}
      />
      {inlinePlayback && (
        <Button
          variant="secondary"
          size="icon"
          className={styles.play}
          aria-label={item.name + (playing ? " 일시정지" : " 재생")}
          onClick={() => {
            if (!video.current) return;
            if (playing) video.current.pause();
            else void video.current.play().catch(() => setFailed(true));
          }}
        >
          {playing ? <CdsActionsPauseIcon /> : <CdsActionsPlayIcon />}
        </Button>
      )}
    </>
  ) : (
    // Authenticated attachment route needs the current browser session.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={item.url}
      alt={item.name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export function Thumbnail({
  chart,
  query,
}: {
  chart: SearchChart;
  query: string;
}) {
  const [index, setIndex] = useState(() =>
    representativeMedia(chart.media, query),
  );
  const item = chart.media[index];
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = container.current;
    const image = box?.querySelector("img");
    if (!box || !image || item?.video || chart.media.length < 2) return;
    const buttons = box.querySelectorAll<HTMLButtonElement>("button");
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 8;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const sample = () => {
      if (!ctx || !image.naturalWidth) return;
      const rect = image.getBoundingClientRect();
      const scale = Math.min(
        rect.width / image.naturalWidth,
        rect.height / image.naturalHeight,
      );
      const w = image.naturalWidth * scale,
        h = image.naturalHeight * scale;
      for (const button of buttons) {
        const area = button.getBoundingClientRect();
        if (!area.width || !area.height) continue;
        ctx.fillStyle = "#101116";
        ctx.fillRect(0, 0, 8, 8);
        ctx.drawImage(
          image,
          ((rect.left + (rect.width - w) / 2 - area.left) * 8) / area.width,
          ((rect.top + (rect.height - h) / 2 - area.top) * 8) / area.height,
          (w * 8) / area.width,
          (h * 8) / area.height,
        );
        try {
          const pixels = ctx.getImageData(0, 0, 8, 8).data;
          let light = 0;
          for (let i = 0; i < pixels.length; i += 4)
            light +=
              pixels[i] * 0.2126 +
              pixels[i + 1] * 0.7152 +
              pixels[i + 2] * 0.0722;
          button.dataset.backdrop = light / 64 >= 128 ? "light" : "dark";
        } catch {
          return;
        } // Cross-origin media keeps the default control tone.
      }
    };
    const observer = new ResizeObserver(sample);
    observer.observe(box);
    image.addEventListener("load", sample);
    sample();
    return () => {
      observer.disconnect();
      image.removeEventListener("load", sample);
      buttons.forEach((b) => delete b.dataset.backdrop);
    };
  }, [item?.id, item?.url, item?.video, chart.media.length]);
  return (
    <div className={styles.thumb} ref={container}>
      {item ? (
        <>
          <PreviewMedia key={item.id} item={item} inlinePlayback={item.video} />
          {chart.media.length > 1 && (
            <>
              <Badge
                variant="secondary"
                className={styles.counter}
                aria-live="polite"
              >
                {index + 1} / {chart.media.length}
              </Badge>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                aria-label="이전 첨부"
                className={styles.previous}
                onClick={() =>
                  setIndex(
                    (index + chart.media.length - 1) % chart.media.length,
                  )
                }
              >
                <ChevronLeftIcon />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                type="button"
                aria-label="다음 첨부"
                className={styles.next}
                onClick={() => setIndex((index + 1) % chart.media.length)}
              >
                <ChevronRightIcon />
              </Button>
            </>
          )}
        </>
      ) : (
        <div className={styles.placeholder}>
          <EmrEmptyState
            surface="widget"
            size="md"
            reserveActionSpace={false}
            kind="no-data"
            icon={<ImageOff />}
            title="첨부된 이미지가 없습니다"
          />
        </div>
      )}
    </div>
  );
}
export function SourceMedia({
  chart,
  query,
}: {
  chart: SearchChart;
  query: string;
}) {
  const [enlarged, setEnlarged] = useState<SearchMedia | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const close = () => {
    setEnlarged(null);
    opener.current?.focus();
  };
  return (
    <div
      onKeyDown={(event) => {
        if (enlarged && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="flex flex-wrap gap-2" aria-label="첨부 자료 목록">
        {chart.media.map((m) => (
          <Button
            key={m.id}
            variant="ghost"
            className={styles.mediaButton}
            aria-label={m.name + " 확대"}
            aria-expanded={enlarged?.id === m.id}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setEnlarged(m);
            }}
          >
            <PreviewMedia item={m} />
            {m.video && (
              <CdsActionsPlayIcon className="pointer-events-none absolute size-5 text-white" />
            )}
          </Button>
        ))}
      </div>
      {enlarged && (
        <section className={styles.enlarged} aria-label="선택한 첨부 미리보기">
          <div className="flex items-center justify-between gap-2">
            <span>
              <Highlight value={enlarged.name} query={query} />
            </span>
            <Button
              autoFocus
              variant="ghost"
              size="icon"
              aria-label="첨부 미리보기 닫기"
              onClick={close}
            >
              <CloseIcon />
            </Button>
          </div>
          <PreviewMedia key={enlarged.id} item={enlarged} controls />
          {enlarged.caption && (
            <p className="emr-text-metadata">{enlarged.caption}</p>
          )}
        </section>
      )}
    </div>
  );
}

export type CopyMode = "existing" | "new";
