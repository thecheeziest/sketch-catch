import * as Application from 'expo-application';
import { Platform } from 'react-native';
import type { AppPlatform } from '@sketch-catch/shared';

export const APP_PLATFORM: AppPlatform = Platform.OS === 'ios' ? 'ios' : 'android';

// 네이티브 빌드 번호(iOS CFBundleVersion / Android versionCode) — OTA로 바뀌지 않아 설치된 바이너리를 구분하는 기준
export const APP_BUILD = Number(Application.nativeBuildVersion);

/** 서버가 최소 빌드 미달 여부를 판단할 때 쓰는 클라이언트 정보 (REST 헤더·소켓 handshake 공통) */
export const APP_CLIENT_INFO = { platform: APP_PLATFORM, build: APP_BUILD } as const;
