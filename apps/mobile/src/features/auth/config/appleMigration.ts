import { applicationId } from 'expo-application';
import { Platform } from 'react-native';

// OTA 설정이 아닌 실제 설치된 앱의 Bundle ID로 이전 방향을 구분한다.
export const canIssueAppleMigrationCode = Platform.OS === 'ios' && applicationId === 'com.sketchcatch.app';
export const canImportAppleAccount = Platform.OS === 'ios' && applicationId === 'com.sketchcatch.ios';
