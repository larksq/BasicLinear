import { useEffect, useRef } from 'react';
import { nativeDateCommitDecision, nativeDateInputShouldSync } from './native-date-input.js';

interface BufferedDateInputProps {
  label: string;
  name?: string;
  value: string | null;
  disabled?: boolean;
  onCommit: (value: string | null) => void;
}

export function BufferedDateInput({
  label,
  name,
  value,
  disabled = false,
  onCommit,
}: BufferedDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const baselineRef = useRef<string | null>(value);
  const dirtyRef = useRef(false);

  useEffect(() => {
    const input = inputRef.current;
    if (input !== null && nativeDateInputShouldSync(
      document.activeElement === input,
      dirtyRef.current,
    )) {
      input.value = value ?? '';
      baselineRef.current = value;
      dirtyRef.current = false;
    }
  });

  return (
    <input
      ref={inputRef}
      aria-label={label}
      name={name}
      type="date"
      defaultValue={value ?? ''}
      disabled={disabled}
      onFocus={() => {
        baselineRef.current = value;
        dirtyRef.current = false;
      }}
      onInput={() => {
        dirtyRef.current = true;
      }}
      onBlur={(event) => {
        const decision = nativeDateCommitDecision(
          value,
          baselineRef.current,
          event.currentTarget.value,
          event.currentTarget.validity.valid,
        );
        dirtyRef.current = false;
        baselineRef.current = value;
        if (decision.action === 'restore') {
          event.currentTarget.value = decision.value;
        } else if (decision.action === 'commit') {
          onCommit(decision.value);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.value = value ?? '';
          baselineRef.current = value;
          dirtyRef.current = false;
          event.currentTarget.blur();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
