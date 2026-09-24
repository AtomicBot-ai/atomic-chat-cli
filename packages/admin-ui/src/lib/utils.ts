// Lifted from Atomic-Chat/web-app/src/lib/utils.ts @ f71e2280b; adapted: `cn()` only (the rest is chat/model/markdown code)
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
