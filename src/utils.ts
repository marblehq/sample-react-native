import {stringToBytes} from '@fridayhome/messages';
import {decode} from 'base-64';

export function base64ToBytes(str?: string | null): number[] {
  if (!str) {
    return [];
  }
  return stringToBytes(decode(str));
}
