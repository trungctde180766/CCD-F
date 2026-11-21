import React from 'react';
import type { ContentBlock } from '../types';

interface BlockRendererProps {
  blocks: ContentBlock[];
  className?: string;
}

/**
 * Renders inline backtick code spans safely as React text nodes without dangerouslySetInnerHTML.
 */
function renderInlineCodeSafe(text: string): React.ReactNode[] {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      const codeContent = part.slice(1, -1);
      return (
        <code
          key={idx}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-200/80 dark:bg-slate-800 font-mono text-[0.9em] text-brand-700 dark:text-brand-300 break-words"
        >
          {codeContent}
        </code>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

/**
 * Renders multiline text preserving explicit line breaks (\n) safely as React elements.
 */
function renderMultilineText(text: string): React.ReactNode {
  const lines = String(text).split('\n');
  return lines.map((line, idx) => (
    <React.Fragment key={idx}>
      {renderInlineCodeSafe(line)}
      {idx < lines.length - 1 && <br />}
    </React.Fragment>
  ));
}

/**
 * Safe ContentBlock renderer for paragraph, heading, and list blocks.
 * - Never coerces blocks into "[object Object]"
 * - Never uses dangerouslySetInnerHTML
 * - Does not fabricate URLs for Learn more items unless an actual http(s) URL is in the item string
 */
export const BlockRenderer: React.FC<BlockRendererProps> = ({ blocks, className = '' }) => {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-3 text-slate-800 dark:text-slate-200 leading-relaxed break-words ${className}`}>
      {blocks.map((block, index) => {
        if (!block || typeof block !== 'object') return null;

        if (block.type === 'paragraph') {
          const text = typeof block.text === 'string' ? block.text : '';
          return (
            <p key={index} className="text-[15px] sm:text-base leading-relaxed break-words">
              {renderMultilineText(text)}
            </p>
          );
        }

        if (block.type === 'heading') {
          const text = typeof block.text === 'string' ? block.text : '';
          const level = String(block.level || '3');
          if (level === '1' || level === '2') {
            return (
              <h3
                key={index}
                className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 pt-2"
              >
                {renderInlineCodeSafe(text)}
              </h3>
            );
          }
          return (
            <h4
              key={index}
              className="text-sm sm:text-base font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300 pt-2"
            >
              {renderInlineCodeSafe(text)}
            </h4>
          );
        }

        if (block.type === 'list') {
          const items = Array.isArray(block.items) ? block.items : [];
          const ListTag = block.ordered ? 'ol' : 'ul';
          const listStyle = block.ordered ? 'list-decimal' : 'list-disc';
          return (
            <ListTag
              key={index}
              className={`${listStyle} pl-5 space-y-1.5 text-[15px] sm:text-base text-slate-800 dark:text-slate-200`}
            >
              {items.map((item, itemIdx) => {
                const strItem = typeof item === 'string' ? item : JSON.stringify(item);
                const isDirectUrl = /^https?:\/\/\S+$/i.test(strItem.trim());
                return (
                  <li key={itemIdx} className="break-words">
                    {isDirectUrl ? (
                      <a
                        href={strItem.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 dark:text-brand-400 underline hover:text-brand-700"
                      >
                        {strItem.trim()}
                      </a>
                    ) : (
                      renderMultilineText(strItem)
                    )}
                  </li>
                );
              })}
            </ListTag>
          );
        }

        return null;
      })}
    </div>
  );
};
