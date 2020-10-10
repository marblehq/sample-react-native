import {Advertisement} from '@fridayhome/messages';
import {Device} from 'react-native-ble-plx';

export interface FridayDevice extends Device {
  friday: Advertisement;
}
