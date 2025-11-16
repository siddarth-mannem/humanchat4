"use client";

import { useCallback, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Message } from '../../../src/lib/db';
import type { ReactNode } from 'react';

interface VirtualMessageListProps {
  messages: Message[];
  className?: string;
  registerScrollContainer?: (node: HTMLDivElement | null) => void;
  children: (message: Message, index: number) => ReactNode;
}

export default function VirtualMessageList({ messages, className, registerScrollContainer, children }: VirtualMessageListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useCallback(
    (node: HTMLDivElement | null) => {
      parentRef.current = node;
      registerScrollContainer?.(node);
    },
    [registerScrollContainer]
  );

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120,
    overscan: 8
  });

  return (
    <div ref={handleRef} className={className}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            {children(messages[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
