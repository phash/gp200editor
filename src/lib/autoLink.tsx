import React from 'react';

const URL_REGEX = /\bhttps?:\/\/[^\s<>"'`]+/g;

interface Props { text: string }

export function AutoLink({ text }: Props) {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(text.slice(lastIndex, start));
    nodes.push(
      <a
        key={start}
        href={url}
        rel="nofollow noopener noreferrer"
        target="_blank"
      >
        {url}
      </a>
    );
    lastIndex = start + url.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return <>{nodes}</>;
}
