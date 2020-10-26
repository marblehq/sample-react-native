// import {stringToBytes} from '@fridayhome/sdk';
import {decode} from 'base-64';

export function base64ToBytes(str?: string | null): Uint8Array {
  if (!str) {
    return new Uint8Array();
  }
  // return stringToBytes(decode(str));
  return new Uint8Array();
}
