import { FontStudioAPI } from '../../../preload/types';

declare global {
  interface Window {
    fontStudioAPI: FontStudioAPI;
  }
}

