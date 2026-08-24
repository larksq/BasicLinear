export interface TextareaHeightTarget {
  readonly scrollHeight: number;
  style: {
    height: string;
  };
}

export function fitTextareaHeight(target: TextareaHeightTarget): number {
  target.style.height = 'auto';
  const height = Math.max(0, Math.ceil(target.scrollHeight));
  target.style.height = `${height}px`;
  return height;
}
